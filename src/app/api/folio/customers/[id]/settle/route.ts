import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// Batch-generate IDs in a SINGLE upsert (prevents SQLite timeout from repeated upserts in a loop)
async function generateIds(prefix: string, count: number, tx?: any): Promise<string[]> {
  const client = tx || db
  const counter = await client.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: count } },
    create: { prefix, lastNumber: count },
  })
  const startNumber = counter.lastNumber - count + 1
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(startNumber + i).padStart(4, '0')}`)
}

// Single ID generation (for non-batch cases)
async function generateId(prefix: string, tx?: any): Promise<string> {
  const ids = await generateIds(prefix, 1, tx)
  return ids[0]
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Process settlement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'settlement')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Parse body early to get optional folioId
    const body = await request.json()
    const { amount, mode, reference, description, folioId: requestedFolioId, autoAllocate, splitPayments } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Settlement amount must be greater than 0' }, { status: 400 })
    }

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
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

    const validModes = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Wallet', 'Cheque', 'Bill to Staff', 'Bill to Company', 'Room Charge', 'BTC (Bitcoin)', 'Other Cryptocurrency', 'Other', 'Card', 'Bank', 'Mixed']
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json({ error: `Invalid payment mode. Must be one of: ${validModes.join(', ')}` }, { status: 400 })
    }

    // ── AUTO-ALLOCATE: Distribute settlement across all folios with outstanding balance ──
    if (autoAllocate) {
      // ── UNIFIED balance calculation (same as settlement-overview & checkout APIs) ──
      // A customer may have charges in one folio and payments in another.
      // The unified balance reflects the TRUE amount owed across all folios.
      const allEntries = customer.folios
        .flatMap(f => f.ledgerEntries)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      let unifiedFinalBalance = customer.openingBalance ?? 0
      for (const e of allEntries) {
        unifiedFinalBalance = unifiedFinalBalance + (e.debit || 0) - (e.credit || 0)
      }
      const unifiedOutstanding = Math.max(0, unifiedFinalBalance)

      const foliosWithBalance = customer.folios
        .map(f => {
          const entries = f.ledgerEntries
          const bal = entries.length > 0 ? entries[entries.length - 1].balance : 0
          return { ...f, currentBalance: bal }
        })
        .filter(f => f.currentBalance > 0)
        .sort((a, b) => b.currentBalance - a.currentBalance)

      if (foliosWithBalance.length === 0) {
        return NextResponse.json({ error: 'No outstanding balances to settle' }, { status: 400 })
      }

      // Cap against UNIFIED outstanding (not per-folio sum) to prevent over-payment
      // e.g. Folio #0: +₹500, Folio #1: -₹200 → unified = ₹300, per-folio sum = ₹500
      if (amount > unifiedOutstanding) {
        return NextResponse.json({ error: `Settlement amount (${amount}) exceeds unified outstanding balance (${unifiedOutstanding}). Cross-folio credits reduce the actual amount owed.` }, { status: 400 })
      }

      // ── PRE-GENERATE all TXN IDs in a SINGLE batch BEFORE the transaction ──
      // This prevents SQLite socket timeout from repeated idCounter.upsert() calls inside the loop.
      // Upper bound: 1 main docNo per folio + (splits.length - 1) extra per folio = folios.length * splits.length
      const splits = Array.isArray(splitPayments) && splitPayments.length > 0 ? splitPayments : [{ method: mode, amount, reference: reference || '' }]
      const totalIdsNeeded = foliosWithBalance.length * splits.length

      const allTxnIds = await generateIds('TXN', Math.max(1, totalIdsNeeded))
      let idIndex = 0

      const result = await db.$transaction(async (tx) => {
        let remaining = amount
        const settledFolios: { folioId: string; amount: number }[] = []

        for (const folio of foliosWithBalance) {
          if (remaining <= 0) break
          const settleAmt = Math.min(remaining, folio.currentBalance)
          remaining -= settleAmt

          const entries = folio.ledgerEntries
          const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null
          const runningBalance = (lastEntry?.balance ?? 0) - settleAmt

          const docNo = allTxnIds[idIndex++] || `TXN-${String(Date.now()).padStart(4, '0')}`

          await tx.settlement.create({
            data: {
              unitCode: session.unitCode, customerId: id, folioId: folio.id,
              amount: settleAmt, mode, reference: reference || '',
              description: description || `Auto-settlement via ${mode}`,
              userId: session.userId, userName: session.name,
            },
          })

          // Handle split payments: create one ledger entry per split
          let splitRemaining = settleAmt

          for (let si = 0; si < splits.length && splitRemaining > 0; si++) {
            const sp = splits[si]
            const spAmt = Math.min(sp.amount || 0, splitRemaining)
            if (spAmt <= 0) continue
            splitRemaining -= spAmt

            const spDocNo = si === 0 ? docNo : (allTxnIds[idIndex++] || `TXN-${String(Date.now()).padStart(4, '0')}`)
            const spBalance = si === splits.length - 1 ? runningBalance : (lastEntry?.balance ?? 0) - (settleAmt - splitRemaining)

            await tx.ledgerEntry.create({
              data: {
                unitCode: session.unitCode, folioId: folio.id, customerId: id,
                date: new Date().toISOString().split('T')[0],
                docNo: spDocNo,
                type: 'Settlement',
                description: si === 0 ? (description || `Auto-settlement via ${sp.method}`) : `Split payment via ${sp.method}`,
                debit: 0, credit: spAmt, balance: spBalance,
                paymentMode: sp.method,
                userId: session.userId, userName: session.name, status: 'Active',
              },
            })
          }

          settledFolios.push({ folioId: folio.id, amount: settleAmt })
        }

        return { settledFolios, totalSettled: amount, remainingBalance: remaining }
      })

      await logAction(session.unitCode, session.userId, session.name, session.role, 'SETTLE_CUSTOMER', customer.fullName, { customerId: customer.customerId, autoAllocate: true, totalAmount: amount, settledFolios: result.settledFolios }, request)

      return NextResponse.json({ success: true, ...result, message: `Auto-settled ${result.settledFolios.length} folio(s)` }, { status: 201 })
    }

    // ── SINGLE FOLIO SETTLEMENT ──
    // Use the requested folioId if it belongs to this customer, otherwise fall back to first active
    let activeFolio = customer.folios[0]
    if (requestedFolioId) {
      const matchingFolio = customer.folios.find((f: any) => f.id === requestedFolioId)
      if (matchingFolio) activeFolio = matchingFolio
    }

    if (!activeFolio) {
      return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
    }

    if (activeFolio.status !== 'Active') {
      return NextResponse.json({ error: 'Folio is not active' }, { status: 400 })
    }

    // Get current balance
    const allActiveEntries = activeFolio.ledgerEntries
    const currentBalance = allActiveEntries.length > 0
      ? allActiveEntries[allActiveEntries.length - 1].balance
      : 0

    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Settlement amount (${amount}) exceeds outstanding balance (${currentBalance})` },
        { status: 400 }
      )
    }

    // Pre-generate the single ID before transaction
    const [docNo] = await generateIds('TXN', 1)

    // Process settlement in a transaction
    const result = await db.$transaction(async (tx) => {
      const lastEntry = allActiveEntries.length > 0 ? allActiveEntries[allActiveEntries.length - 1] : null
      const runningBalance = (lastEntry?.balance ?? 0) - amount

      const settlement = await tx.settlement.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          folioId: activeFolio.id,
          amount,
          mode,
          reference: reference || '',
          description: description || `Settlement via ${mode}`,
          userId: session.userId,
          userName: session.name,
        },
      })

      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: id,
          date: new Date().toISOString().split('T')[0],
          docNo,
          type: 'Settlement',
          description: description || `Settlement via ${mode}`,
          debit: 0,
          credit: amount,
          balance: runningBalance,
          paymentMode: mode,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      const isFullySettled = runningBalance <= 0

      return { settlement, ledgerEntry, isFullySettled, runningBalance }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'SETTLE_CUSTOMER',
      customer.fullName,
      {
        customerId: customer.customerId,
        folioId: activeFolio.folioId,
        amount: body.amount,
        mode: body.mode,
        isFullySettled: result.isFullySettled,
        remainingBalance: result.runningBalance,
      },
      request
    )

    // Audit log — non-critical, don't fail the settlement if this fails
    try {
      await db.folioAuditLog.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          folioId: activeFolio.id,
          action: 'Settlement',
          target: 'Folio',
          details: JSON.stringify({
            amount: body.amount,
            mode: body.mode,
            reference: body.reference,
            isFullySettled: result.isFullySettled,
            remainingBalance: result.runningBalance,
          }),
          userId: session.userId,
          userName: session.name,
          ipAddress: getClientIp(request),
          device: request.headers.get('user-agent') || '',
        },
      })
    } catch (auditErr) {
      console.error('Settlement succeeded but audit log failed:', auditErr)
    }

    return NextResponse.json({
      settlement: result.settlement,
      ledgerEntry: result.ledgerEntry,
      isFullySettled: result.isFullySettled,
      remainingBalance: result.runningBalance,
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing settlement:', error)
    const message = error instanceof Error ? error.message : 'Failed to process settlement'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}