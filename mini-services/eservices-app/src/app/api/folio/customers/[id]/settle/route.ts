import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

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

    if (!sessionHasPermission(session, 'khata', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const activeFolio = customer.folios[0]
    if (!activeFolio) {
      return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
    }

    if (activeFolio.status !== 'Active') {
      return NextResponse.json({ error: 'Folio is not active' }, { status: 400 })
    }

    const body = await request.json()
    const { amount, mode, reference, description } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Settlement amount must be greater than 0' }, { status: 400 })
    }

    const validModes = ['Cash', 'UPI', 'Card', 'Bank', 'Wallet', 'Mixed']
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json({ error: `Invalid payment mode. Must be one of: ${validModes.join(', ')}` }, { status: 400 })
    }

    // Get current balance
    const currentBalance = activeFolio.ledgerEntries[0]?.balance ?? customer.openingBalance ?? 0

    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Settlement amount (${amount}) exceeds outstanding balance (${currentBalance})` },
        { status: 400 }
      )
    }

    // Process settlement in a transaction
    const result = await db.$transaction(async (tx) => {
      const lastEntry = activeFolio.ledgerEntries[0]
      const runningBalance = (lastEntry?.balance ?? customer.openingBalance ?? 0) - amount

      // Create Settlement record
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

      // Add Payment ledger entry
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: id,
          date: new Date().toISOString().split('T')[0],
          type: 'Settlement',
          description: description || `Settlement via ${mode}`,
          debit: 0,
          credit: amount,
          balance: runningBalance,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      // Check if fully settled
      const isFullySettled = runningBalance <= 0

      if (isFullySettled) {
        // Lock folio and update status
        await tx.folio.update({
          where: { id: activeFolio.id },
          data: {
            status: 'Settled',
            lockedAt: new Date(),
            lockedBy: session.userId,
            settledAt: new Date(),
            settledBy: session.userId,
          },
        })

        // Update customer status
        await tx.customer.update({
          where: { id },
          data: { status: 'Settled' },
        })

        // Close any open visit
        await tx.customerVisit.updateMany({
          where: { customerId: id, checkOutAt: null },
          data: { checkOutAt: new Date() },
        })
      }

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

    return NextResponse.json({
      settlement: result.settlement,
      ledgerEntry: result.ledgerEntry,
      isFullySettled: result.isFullySettled,
      remainingBalance: result.runningBalance,
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing settlement:', error)
    return NextResponse.json({ error: 'Failed to process settlement' }, { status: 500 })
  }
}
