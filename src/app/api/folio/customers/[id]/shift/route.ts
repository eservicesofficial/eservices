import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// Helper: Recalculate running balances for a folio within a transaction
// Returns the final balance after recalculation
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

// POST: Transfer (move) selected transactions from one folio to another
// Strict POS behavior: MOVE not copy, keep original data, recalculate all balances
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { entryIds, targetFolioId } = body

    // ── Step 0: Validate inputs ──
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one transaction to transfer' }, { status: 400 })
    }

    if (!targetFolioId) {
      return NextResponse.json({ error: 'Target folio is required' }, { status: 400 })
    }

    // ── Step 1: Validate the customer and both folios ──
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          orderBy: { folioNumber: 'asc' },
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Find the target folio — search by ID (supports both Active folios)
    const targetFolio = customer.folios.find(f => f.id === targetFolioId)
    if (!targetFolio) {
      return NextResponse.json({ error: 'Target folio not found' }, { status: 404 })
    }

    if (targetFolio.status !== 'Active') {
      return NextResponse.json({ error: `Target folio ${String(targetFolio.folioNumber).padStart(4, '0')} is not active` }, { status: 400 })
    }

    // ── Step 2: Validate selected transactions ──
    // Search by entry ID + current folio — find the actual current folio for each entry
    const entriesToMove = await db.ledgerEntry.findMany({
      where: {
        id: { in: entryIds },
        customerId: id,
        status: 'Active',
      },
      orderBy: { createdAt: 'asc' },
    })

    if (entriesToMove.length === 0) {
      return NextResponse.json({ error: 'Selected transactions not found. They may have been already transferred or removed.' }, { status: 400 })
    }

    // Check for missing entries
    if (entriesToMove.length !== entryIds.length) {
      const foundIds = new Set(entriesToMove.map(e => e.id))
      const missing = (entryIds as string[]).filter(eid => !foundIds.has(eid))
      return NextResponse.json(
        { error: `${missing.length} transaction(s) not found or already removed` },
        { status: 400 }
      )
    }

    // Check for entries already in target folio
    const alreadyInTarget = entriesToMove.filter(e => e.folioId === targetFolioId)
    if (alreadyInTarget.length > 0) {
      return NextResponse.json(
        { error: `${alreadyInTarget.length} transaction(s) are already in the target folio` },
        { status: 400 }
      )
    }

    // Group source folios for balance recalculation
    const sourceFolioIds = [...new Set(entriesToMove.map(e => e.folioId))]
    const sourceFolioMap = new Map<string, number>() // folioId -> folioNumber
    for (const f of customer.folios) {
      sourceFolioMap.set(f.id, f.folioNumber)
    }

    // ── Step 3-6: Execute transfer in a single database transaction ──
    const transferDateTime = new Date().toISOString()
    const result = await db.$transaction(async (tx) => {
      const movedEntries: any[] = []

      for (const entry of entriesToMove) {
        const sourceFolioNumber = sourceFolioMap.get(entry.folioId) ?? 0
        const targetFolioNumber = targetFolio.folioNumber

        // Move: update folioId + append transfer marker to description
        // Keep ALL original data: docNo, invoiceNo, type, debit, credit, tax, discount, paymentMode, timestamps
        const transferMarker = ` [Transferred from Folio ${String(sourceFolioNumber).padStart(4, '0')}]`
        const newDescription = entry.description
          ? entry.description + transferMarker
          : `Transferred from Folio ${String(sourceFolioNumber).padStart(4, '0')}`

        const updated = await tx.ledgerEntry.update({
          where: { id: entry.id },
          data: {
            folioId: targetFolioId,
            description: newDescription,
            status: 'Active', // ensure active status
          },
        })
        movedEntries.push(updated)
      }

      // ── Step 5: Recalculate balances for ALL affected folios ──
      const sourceNewBalances: Record<string, number> = {}
      for (const sourceFolioId of sourceFolioIds) {
        sourceNewBalances[sourceFolioId] = await recalculateFolioBalances(tx, sourceFolioId, id)
      }
      const targetNewBalance = await recalculateFolioBalances(tx, targetFolioId, id)

      // ── Step 6: Record transfer history in audit log ──
      const auditLogs = entriesToMove.map(entry => ({
        unitCode: session.unitCode,
        customerId: id,
        folioId: targetFolioId,
        action: 'Transfer' as const,
        target: 'LedgerEntry' as const,
        details: JSON.stringify({
          entryId: entry.id,
          docNo: entry.docNo,
          sourceFolioId: entry.folioId,
          sourceFolioNumber: sourceFolioMap.get(entry.folioId) ?? 0,
          targetFolioId,
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

      if (auditLogs.length > 0) {
        await tx.folioAuditLog.createMany({ data: auditLogs })
      }

      return {
        movedEntries,
        count: movedEntries.length,
        sourceNewBalances,
        targetNewBalance,
      }
    })

    // Log action (outside transaction — non-critical)
    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'TRANSFER_TRANSACTIONS',
      customer.fullName,
      {
        customerId: customer.customerId,
        sourceFolioIds,
        targetFolioId,
        targetFolioNumber: targetFolio.folioNumber,
        count: result.count,
        entryIds: result.movedEntries.map(e => e.id),
        docNos: result.movedEntries.map(e => e.docNo),
        sourceNewBalances: result.sourceNewBalances,
        targetNewBalance: result.targetNewBalance,
        transferDate: transferDateTime,
      },
      request
    )

    return NextResponse.json({
      success: true,
      count: result.count,
      sourceNewBalances: result.sourceNewBalances,
      targetNewBalance: result.targetNewBalance,
      movedEntries: result.movedEntries.map(e => ({
        id: e.id,
        docNo: e.docNo,
        type: e.type,
        description: e.description,
      })),
      message: `${result.count} transaction(s) transferred to Folio ${String(targetFolio.folioNumber).padStart(4, '0')}`,
    })
  } catch (error) {
    console.error('Error transferring transactions:', error)
    return NextResponse.json({ error: 'Failed to transfer transactions' }, { status: 500 })
  }
}