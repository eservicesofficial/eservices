import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(4, '0')}`
}

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

    if (!sessionHasPermission(session, 'customerFolio', 'refund')) {
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

    // Parse body first to get amount
    const body = await request.json()
    const { amount, description, docNo, invoiceNo, date } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be greater than 0' }, { status: 400 })
    }

    // Refund = Debit entry: increases balance toward 0 from negative
    // Debit = money added back to balance (customer gets money back)
    const result = await db.$transaction(async (tx) => {
      // Use the first active folio for the refund entry
      const activeFolio = await tx.folio.findFirst({
        where: { customerId: id, status: 'Active' },
        orderBy: { createdAt: 'desc' },
      })
      if (!activeFolio) {
        throw new Error('No active folio found')
      }

      // Read fresh balance inside transaction (from ALL folios combined to check for credit balance)
      const allEntries = await tx.ledgerEntry.findMany({
        where: { customerId: id, status: 'Active' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      })
      const currentBalance = allEntries[0]?.balance ?? customer.openingBalance ?? 0

      // Refund is ONLY allowed when customer has a credit balance (overpaid)
      if (currentBalance >= 0) {
        throw new Error(`Refund requires a credit balance. Current balance is ₹${currentBalance.toLocaleString('en-IN')}. Customer must have overpaid to process a refund.`)
      }

      // Refund amount cannot exceed the credit balance (absolute value of negative balance)
      const maxRefund = Math.abs(currentBalance)
      if (amount > maxRefund) {
        throw new Error(`Refund amount (₹${amount.toLocaleString('en-IN')}) exceeds available credit balance (₹${maxRefund.toLocaleString('en-IN')})`)
      }

      // Read fresh balance inside transaction
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: { folioId: activeFolio.id, status: 'Active' },
        orderBy: { createdAt: 'desc' },
      })
      const runningBalance = (lastEntry?.balance ?? customer.openingBalance ?? 0) + amount

      const refundDocNo = docNo || await generateId('TXN')

      // Create Refund ledger entry (DEBIT — increases balance, money returned to customer)
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: id,
          date: date || new Date().toISOString().split('T')[0],
          docNo: refundDocNo,
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
        folioId: result.ledgerEntry.folioId,
        amount: body.amount,
        newBalance: result.runningBalance,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: customer.folios[0]?.id || '',
        action: 'Refund',
        target: 'LedgerEntry',
        details: JSON.stringify({
          amount: body.amount,
          description: body.description,
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
      newBalance: result.runningBalance,
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing refund:', error)
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }
}
