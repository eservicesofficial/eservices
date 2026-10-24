import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Split a transaction (ledger entry) to another folio
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
    const { entryId, targetFolioId, splitAmount, description } = body

    if (!entryId || !targetFolioId) {
      return NextResponse.json({ error: 'Entry ID and target Folio ID are required' }, { status: 400 })
    }

    // Verify customer exists
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get the original entry FIRST (before using it)
    const originalEntry = await db.ledgerEntry.findUnique({
      where: { id: entryId },
    })

    if (!originalEntry || originalEntry.customerId !== id) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (originalEntry.status !== 'Active') {
      return NextResponse.json({ error: 'Cannot split a cancelled entry' }, { status: 400 })
    }

    // NOW find the source and target folios using originalEntry.folioId
    const sourceFolio = customer.folios.find(f => f.id === originalEntry.folioId)
    const targetFolio = customer.folios.find(f => f.id === targetFolioId)

    if (!sourceFolio) {
      return NextResponse.json({ error: 'Source folio not found' }, { status: 400 })
    }

    if (sourceFolio.status !== 'Active') {
      return NextResponse.json({ error: 'Source folio is not active' }, { status: 400 })
    }

    if (!targetFolio) {
      return NextResponse.json({ error: 'Target folio not found for this customer' }, { status: 404 })
    }

    if (targetFolio.status !== 'Active') {
      return NextResponse.json({ error: 'Target folio is not active' }, { status: 400 })
    }

    // Determine split amount
    const amount = splitAmount && splitAmount > 0 ? splitAmount : originalEntry.debit || originalEntry.credit

    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid split amount' }, { status: 400 })
    }

    const isFullSplit = amount >= (originalEntry.debit || originalEntry.credit)

    // Process split in transaction
    const result = await db.$transaction(async (tx) => {
      if (isFullSplit) {
        // Full split: move the entry to the target folio
        // First, get the last balance in the target folio
        const targetLastEntry = await tx.ledgerEntry.findFirst({
          where: { folioId: targetFolioId, status: 'Active' },
          orderBy: { createdAt: 'desc' },
        })

        const targetBalance = targetLastEntry?.balance ?? 0

        // Calculate new balance in target folio
        const newTargetBalance = targetBalance + (originalEntry.debit - originalEntry.credit)

        // Move entry to target folio
        const movedEntry = await tx.ledgerEntry.update({
          where: { id: entryId },
          data: {
            folioId: targetFolioId,
            balance: newTargetBalance,
            description: originalEntry.description ? `${originalEntry.description} [Split: ${description || 'Transferred'}]` : `Split to ${targetFolio.folioId}`,
          },
        })

        // Recalculate source folio balances
        const sourceEntries = await tx.ledgerEntry.findMany({
          where: { folioId: sourceFolio.id, status: 'Active' },
          orderBy: { createdAt: 'asc' },
        })

        // Recompute running balances from openingBalance
        const srcCustomer = await tx.customer.findUnique({ where: { id }, select: { openingBalance: true } })
        let runningBalance = srcCustomer?.openingBalance ?? 0
        for (const entry of sourceEntries) {
          runningBalance = runningBalance + entry.debit - entry.credit
          await tx.ledgerEntry.update({
            where: { id: entry.id },
            data: { balance: runningBalance },
          })
        }

        return { type: 'full', movedEntry }
      } else {
        // Partial split: reduce original entry and create new entry in target
        const reduction = amount

        // Reduce the original entry
        const isDebit = originalEntry.debit > 0
        await tx.ledgerEntry.update({
          where: { id: entryId },
          data: {
            debit: isDebit ? originalEntry.debit - reduction : originalEntry.debit,
            credit: !isDebit ? originalEntry.credit - reduction : originalEntry.credit,
          },
        })

        // Get target folio's last balance
        const targetLastEntry = await tx.ledgerEntry.findFirst({
          where: { folioId: targetFolioId, status: 'Active' },
          orderBy: { createdAt: 'desc' },
        })

        const targetBalance = targetLastEntry?.balance ?? 0
        const newTargetBalance = targetBalance + (isDebit ? reduction : -reduction)

        // Create new entry in target folio
        const newEntry = await tx.ledgerEntry.create({
          data: {
            unitCode: session.unitCode,
            folioId: targetFolioId,
            customerId: id,
            date: originalEntry.date,
            docNo: originalEntry.docNo,
            invoiceNo: originalEntry.invoiceNo,
            type: originalEntry.type,
            description: (originalEntry.description || originalEntry.type) + (description ? ` [Split: ${description}]` : ' [Partial Split]'),
            debit: isDebit ? reduction : 0,
            credit: !isDebit ? reduction : 0,
            balance: newTargetBalance,
            paymentMode: originalEntry.paymentMode || '',
            userId: session.userId,
            userName: session.name,
            status: 'Active',
          },
        })

        // Recalculate source folio balances
        const sourceEntries = await tx.ledgerEntry.findMany({
          where: { folioId: sourceFolio.id, status: 'Active' },
          orderBy: { createdAt: 'asc' },
        })

        // Recalculate source folio balances from openingBalance
        const srcCustomer = await tx.customer.findUnique({ where: { id }, select: { openingBalance: true } })
        let runningBalance = srcCustomer?.openingBalance ?? 0
        for (const entry of sourceEntries) {
          runningBalance = runningBalance + entry.debit - entry.credit
          await tx.ledgerEntry.update({
            where: { id: entry.id },
            data: { balance: runningBalance },
          })
        }

        return { type: 'partial', newEntry }
      }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'SPLIT_TRANSACTION',
      customer.fullName,
      {
        customerId: customer.customerId,
        entryId,
        targetFolioId,
        amount,
        splitType: result.type,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: sourceFolio.id,
        action: 'Transfer',
        target: 'LedgerEntry',
        details: JSON.stringify({
          entryId,
          targetFolioId,
          amount,
          splitType: result.type,
          description,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json({
      success: true,
      splitType: result.type,
      message: result.type === 'full' ? 'Transaction transferred to target folio' : `₹${amount.toLocaleString('en-IN')} split to target folio`,
    })
  } catch (error) {
    console.error('Error splitting transaction:', error)
    return NextResponse.json({ error: 'Failed to split transaction' }, { status: 500 })
  }
}
