import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

async function generateId(prefix: string, tx?: any): Promise<string> {
  const client = tx || db
  const counter = await client.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(4, '0')}`
}

// Helper: Recalculate running balances for a folio within a transaction
// Only considers 'Active' entries (moved entries keep 'Active' status)
async function recalculateFolioBalances(tx: any, folioId: string, customerId: string): Promise<number> {
  const entries = await tx.ledgerEntry.findMany({
    where: { folioId, status: 'Active' },
    orderBy: { createdAt: 'asc' },
  })
  const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { openingBalance: true } })
  let runningBalance = customer?.openingBalance ?? 0
  for (const entry of entries) {
    runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0)
    await tx.ledgerEntry.update({
      where: { id: entry.id },
      data: { balance: runningBalance },
    })
  }
  return runningBalance
}

// POST: Transfer (MOVE) selected transactions from source customer to target customer
// Transfer = Move, NOT Copy.
// - Original entries are UPDATEd: only folioId and customerId change
// - Transaction ID, Order ID, invoice details, timestamps, taxes, discounts, payment info all preserved
// - No new transaction is created — the exact same record moves to the target folio
// - Running balances are recalculated for both source and target folios
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEdit = sessionHasPermission(session, 'customerFolio', 'edit')
    const canTransfer = (() => { try { const p = session.permissions || {}; return p?.customerFolio?.transferOperation || false } catch { return false } })()
    if (!canEdit && !canTransfer) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { targetCustomerId, amount, description, entryIds } = body

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Target customer is required' }, { status: 400 })
    }

    if (id === targetCustomerId) {
      return NextResponse.json({ error: 'Cannot transfer to the same customer' }, { status: 400 })
    }

    const hasEntries = Array.isArray(entryIds) && entryIds.length > 0

    // If no entries selected, do a pure balance transfer (creates new entries on both sides)
    if (!hasEntries) {
      return await pureBalanceTransfer(id, targetCustomerId, amount || 0, description, session, request)
    }

    // ═══════════════════════════════════════════════════════════════
    // ENTRY TRANSFER: Pure MOVE — no copies, no new Transaction IDs
    // ═══════════════════════════════════════════════════════════════

    // ── Step 1: Validate source customer ──
    const sourceCustomer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
        },
      },
    })

    if (!sourceCustomer || sourceCustomer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Source customer not found' }, { status: 404 })
    }

    let sourceFolio = sourceCustomer.folios[0]
    // Fallback 1: if no active folio found by status, check primaryFolioId via folioId field
    if (!sourceFolio && sourceCustomer.primaryFolioId) {
      const primaryFolio = await db.folio.findFirst({
        where: { folioId: sourceCustomer.primaryFolioId, customerId: id },
      })
      if (primaryFolio) sourceFolio = primaryFolio
    }
    // Fallback 2: try finding ANY folio for this customer (handles reopened folios)
    if (!sourceFolio) {
      const anyFolio = await db.folio.findFirst({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      })
      if (anyFolio) sourceFolio = anyFolio
    }
    if (!sourceFolio) {
      return NextResponse.json({ error: 'Source customer has no active folio' }, { status: 400 })
    }

    // ── Step 2: Validate entries exist and belong to the source customer ──
    const entriesToMove = await db.ledgerEntry.findMany({
      where: {
        id: { in: entryIds },
        customerId: id,
        status: 'Active',
      },
      orderBy: { createdAt: 'asc' },
    })

    if (entriesToMove.length === 0) {
      return NextResponse.json(
        { error: 'Selected transactions not found. They may have been already transferred or removed.' },
        { status: 400 }
      )
    }

    if (entriesToMove.length !== entryIds.length) {
      const foundIds = new Set(entriesToMove.map(e => e.id))
      const missing = (entryIds as string[]).filter(eid => !foundIds.has(eid))
      return NextResponse.json(
        { error: `${missing.length} transaction(s) not found or already removed` },
        { status: 400 }
      )
    }

    // ── Step 3: Validate target customer ──
    const targetCustomer = await db.customer.findUnique({
      where: { id: targetCustomerId },
      include: {
        folios: {
          where: { status: 'Active' },
        },
      },
    })

    if (!targetCustomer || targetCustomer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Target customer not found' }, { status: 404 })
    }

    let targetFolio = targetCustomer.folios[0]
    // Fallback 1: if no active folio found by status, check primaryFolioId via folioId field
    if (!targetFolio && targetCustomer.primaryFolioId) {
      const primaryFolio = await db.folio.findFirst({
        where: { folioId: targetCustomer.primaryFolioId, customerId: targetCustomerId },
      })
      if (primaryFolio) targetFolio = primaryFolio
    }
    // Fallback 2: try finding ANY folio for this customer (handles reopened folios)
    if (!targetFolio) {
      const anyFolio = await db.folio.findFirst({
        where: { customerId: targetCustomerId },
        orderBy: { createdAt: 'desc' },
      })
      if (anyFolio) targetFolio = anyFolio
    }
    if (!targetFolio) {
      return NextResponse.json({ error: 'Target customer has no active folio. Reopen them first.' }, { status: 400 })
    }

    const transferDateTime = new Date().toISOString()

    // Calculate net amounts for reporting (not for creating entries)
    const totalMovedDebit = entriesToMove.reduce((s, e) => s + (e.debit || 0), 0)
    const totalMovedCredit = entriesToMove.reduce((s, e) => s + (e.credit || 0), 0)
    const netTransferAmount = amount || totalMovedDebit

    // ── Step 4: Execute MOVE in a single database transaction ──
    const result = await db.$transaction(async (tx) => {
      // 4a. MOVE each entry: change ONLY folioId, customerId, and description
      //     ALL original data preserved: docNo, invoiceNo, type, debit, credit,
      //     tax, discount, paymentMode, date, timestamps, etc.
      const movedEntries: any[] = []
      for (const entry of entriesToMove) {
        const transferMarker = ` [Transferred From ${sourceCustomer.customerId}]`
        const newDescription = entry.description
          ? entry.description + transferMarker
          : `Transferred From ${sourceCustomer.customerId}`

        const updated = await tx.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            folioId: targetFolio.id,
            customerId: targetCustomerId,
            description: newDescription,
            // status stays 'Active' — the entry is simply in a new folio now
          },
        })
        movedEntries.push(updated)
      }

      // 4b. Recalculate running balances for SOURCE folio
      //     The moved entries are gone, so the balance drops naturally
      const sourceFinalBalance = await recalculateFolioBalances(tx, sourceFolio.id, id)

      // 4c. Recalculate running balances for TARGET folio
      //     The moved entries are now here, so the balance updates naturally
      const targetFinalBalance = await recalculateFolioBalances(tx, targetFolio.id, targetCustomerId)

      // 4d. Record full transfer history in audit log (source side)
      const sourceAuditLogs = entriesToMove.map(entry => ({
        unitCode: session.unitCode,
        customerId: id,
        folioId: sourceFolio.id,
        action: 'Transfer' as const,
        target: 'LedgerEntry' as const,
        details: JSON.stringify({
          entryId: entry.id,
          docNo: entry.docNo,
          direction: 'outgoing',
          sourceCustomerId: sourceCustomer.customerId,
          sourceCustomerName: sourceCustomer.fullName,
          sourceFolioId: sourceFolio.id,
          sourceFolioNumber: sourceFolio.folioNumber,
          targetCustomerId: targetCustomer.customerId,
          targetCustomerName: targetCustomer.fullName,
          targetFolioId: targetFolio.id,
          targetFolioNumber: targetFolio.folioNumber,
          entryType: entry.type,
          description: entry.description,
          debit: entry.debit,
          credit: entry.credit,
          tax: entry.tax,
          discount: entry.discount,
          paymentMode: entry.paymentMode,
          transferDate: transferDateTime,
          transferredBy: session.name,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      }))

      // 4e. Record audit log (target side)
      const targetAuditLogs = entriesToMove.map(entry => ({
        unitCode: session.unitCode,
        customerId: targetCustomerId,
        folioId: targetFolio.id,
        action: 'Transfer' as const,
        target: 'LedgerEntry' as const,
        details: JSON.stringify({
          entryId: entry.id,
          docNo: entry.docNo,
          direction: 'incoming',
          sourceCustomerId: sourceCustomer.customerId,
          sourceCustomerName: sourceCustomer.fullName,
          sourceFolioNumber: sourceFolio.folioNumber,
          targetCustomerId: targetCustomer.customerId,
          targetCustomerName: targetCustomer.fullName,
          targetFolioId: targetFolio.id,
          targetFolioNumber: targetFolio.folioNumber,
          entryType: entry.type,
          debit: entry.debit,
          credit: entry.credit,
          transferDate: transferDateTime,
          transferredBy: session.name,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      }))

      if (sourceAuditLogs.length > 0) {
        await tx.folioAuditLog.createMany({ data: sourceAuditLogs })
      }
      if (targetAuditLogs.length > 0) {
        await tx.folioAuditLog.createMany({ data: targetAuditLogs })
      }

      return {
        movedEntries,
        count: movedEntries.length,
        sourceFinalBalance,
        targetFinalBalance,
        netTransferAmount,
        totalMovedDebit,
        totalMovedCredit,
      }
    })

    // Log action (outside transaction — non-critical)
    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'TRANSFER_TRANSACTIONS',
      `${sourceCustomer.fullName} → ${targetCustomer.fullName}`,
      {
        sourceCustomerId: sourceCustomer.customerId,
        targetCustomerId: targetCustomer.customerId,
        count: result.count,
        entryIds: result.movedEntries.map(e => e.id),
        docNos: result.movedEntries.map(e => e.docNo),
        netAmount: result.netTransferAmount,
        sourceNewBalance: result.sourceFinalBalance,
        targetNewBalance: result.targetFinalBalance,
        transferDate: transferDateTime,
      },
      request
    )

    return NextResponse.json({
      success: true,
      count: result.count,
      netAmount: result.netTransferAmount,
      source: {
        newBalance: result.sourceFinalBalance,
      },
      target: {
        newBalance: result.targetFinalBalance,
      },
      message: `${result.count} transaction(s) transferred from ${sourceCustomer.fullName} to ${targetCustomer.fullName}`,
    }, { status: 200 })
  } catch (error) {
    console.error('Error transferring:', error)
    return NextResponse.json({ error: 'Failed to transfer' }, { status: 500 })
  }
}

// Pure balance transfer (no entries selected) — creates new Transfer entries on both sides
async function pureBalanceTransfer(
  sourceId: string,
  targetId: string,
  amount: number,
  description: string,
  session: any,
  request: NextRequest
) {
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Amount is required when no transactions are selected' }, { status: 400 })
  }

  const [sourceCustomer, targetCustomer] = await Promise.all([
    db.customer.findUnique({
      where: { id: sourceId },
      include: { folios: { where: { status: 'Active' } } },
    }),
    db.customer.findUnique({
      where: { id: targetId },
      include: { folios: { where: { status: 'Active' } } },
    }),
  ])

  if (!sourceCustomer || sourceCustomer.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Source customer not found' }, { status: 404 })
  }
  if (!targetCustomer || targetCustomer.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Target customer not found' }, { status: 404 })
  }

  let sourceFolio = sourceCustomer.folios[0]
  if (!sourceFolio && sourceCustomer.primaryFolioId) {
    const pf = await db.folio.findFirst({ where: { folioId: sourceCustomer.primaryFolioId, customerId: sourceId } })
    if (pf) sourceFolio = pf
  }
  if (!sourceFolio) {
    const anyFolio = await db.folio.findFirst({ where: { customerId: sourceId }, orderBy: { createdAt: 'desc' } })
    if (anyFolio) sourceFolio = anyFolio
  }
  let targetFolio = targetCustomer.folios[0]
  if (!targetFolio && targetCustomer.primaryFolioId) {
    const pf = await db.folio.findFirst({ where: { folioId: targetCustomer.primaryFolioId, customerId: targetId } })
    if (pf) targetFolio = pf
  }
  if (!targetFolio) {
    const anyFolio = await db.folio.findFirst({ where: { customerId: targetId }, orderBy: { createdAt: 'desc' } })
    if (anyFolio) targetFolio = anyFolio
  }
  if (!sourceFolio) return NextResponse.json({ error: 'Source has no active folio' }, { status: 400 })
  if (!targetFolio) return NextResponse.json({ error: 'Target has no active folio. Reopen them first.' }, { status: 400 })

  const transferDate = new Date().toISOString().split('T')[0]
  const transferDesc = description || `Balance transfer to ${targetCustomer.customerId} (${targetCustomer.fullName})`

  const result = await db.$transaction(async (tx) => {
    // Credit on source (reduces balance)
    const sourceNewBal = await recalculateFolioBalances(tx, sourceFolio.id, sourceId)
    const finalSourceBal = sourceNewBal - amount

    const sourceDocNo = await generateId('TXN', tx)
    await tx.ledgerEntry.create({
      data: {
        unitCode: session.unitCode, folioId: sourceFolio.id, customerId: sourceId,
        date: transferDate, docNo: sourceDocNo, type: 'Transfer',
        description: transferDesc, debit: 0, credit: amount, balance: finalSourceBal,
        userId: session.userId, userName: session.name, status: 'Active',
      },
    })

    // Debit on target (increases balance)
    const targetNewBal = await recalculateFolioBalances(tx, targetFolio.id, targetId)
    const finalTargetBal = targetNewBal + amount

    const targetDocNo = await generateId('TXN', tx)
    await tx.ledgerEntry.create({
      data: {
        unitCode: session.unitCode, folioId: targetFolio.id, customerId: targetId,
        date: transferDate, docNo: targetDocNo, type: 'Transfer',
        description: `Received from ${sourceCustomer.customerId} (${sourceCustomer.fullName})`, debit: amount, credit: 0,
        balance: finalTargetBal, userId: session.userId, userName: session.name, status: 'Active',
      },
    })

    return { sourceDocNo, targetDocNo, finalSourceBal, finalTargetBal }
  })

  await logAction(
    session.unitCode, session.userId, session.name, session.role,
    'TRANSFER_BALANCE', `${sourceCustomer.fullName} → ${targetCustomer.fullName}`,
    { amount, sourceNewBalance: result.finalSourceBal, targetNewBalance: result.finalTargetBal },
    request
  )

  return NextResponse.json({
    success: true,
    count: 0,
    netAmount: amount,
    source: { docNo: result.sourceDocNo, newBalance: result.finalSourceBal },
    target: { docNo: result.targetDocNo, newBalance: result.finalTargetBal },
    message: `₹${amount.toLocaleString('en-IN')} transferred from ${sourceCustomer.fullName} to ${targetCustomer.fullName}`,
  }, { status: 201 })
}