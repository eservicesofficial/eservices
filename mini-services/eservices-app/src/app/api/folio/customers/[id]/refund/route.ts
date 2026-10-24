import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Process refund
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
      return NextResponse.json({ error: 'No active folio found. Reopen the customer first.' }, { status: 400 })
    }

    const body = await request.json()
    const { amount, description, docNo, invoiceNo, date } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be greater than 0' }, { status: 400 })
    }

    // Get current balance
    const currentBalance = activeFolio.ledgerEntries[0]?.balance ?? customer.openingBalance ?? 0

    // Refund adds to customer's balance (debit — customer gets money back, owes more)
    const result = await db.$transaction(async (tx) => {
      // Read fresh balance inside transaction
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: { folioId: activeFolio.id, status: 'Active' },
        orderBy: { createdAt: 'desc' },
      })
      const runningBalance = (lastEntry?.balance ?? customer.openingBalance ?? 0) + amount

      // Create Refund ledger entry (debit - increases balance)
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: id,
          date: date || new Date().toISOString().split('T')[0],
          docNo: docNo || '',
          invoiceNo: invoiceNo || '',
          type: 'Refund',
          description: description || 'Refund issued',
          debit: amount,
          credit: 0,
          balance: runningBalance,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      return { ledgerEntry, runningBalance }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'REFUND_CUSTOMER',
      customer.fullName,
      {
        customerId: customer.customerId,
        folioId: activeFolio.folioId,
        amount: body.amount,
        previousBalance: currentBalance,
        newBalance: result.runningBalance,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: activeFolio.id,
        action: 'Refund',
        target: 'LedgerEntry',
        details: JSON.stringify({
          amount: body.amount,
          description: body.description,
          previousBalance: currentBalance,
          newBalance: result.runningBalance,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json({
      ledgerEntry: result.ledgerEntry,
      previousBalance: currentBalance,
      newBalance: result.runningBalance,
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }
}
