import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Generate statement data for a date range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        tags: true,
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type')

    // Default date range: from beginning of time to now
    const fromDate = from ? new Date(from) : new Date('2020-01-01')
    const toDate = to ? new Date(to) : new Date()
    toDate.setHours(23, 59, 59, 999)

    // Get all ledger entries within date range
    const where: Record<string, unknown> = {
      customerId: id,
      status: 'Active',
      createdAt: { gte: fromDate, lte: toDate },
    }
    if (type) {
      where.type = type
    }

    const [entries, settlements] = await Promise.all([
      db.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      }),
      db.settlement.findMany({
        where: {
          customerId: id,
          createdAt: { gte: fromDate, lte: toDate },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    // Compute period summary
    const totalCharges = entries.reduce((sum, e) => sum + e.debit, 0)
    const totalPayments = entries.reduce((sum, e) => sum + e.credit, 0)
    const totalTax = entries.reduce((sum, e) => sum + e.tax, 0)
    const totalDiscount = entries.reduce((sum, e) => sum + e.discount, 0)
    const totalSettlements = settlements.reduce((sum, s) => sum + s.amount, 0)
    // Refunds use debit (money added back to balance)
    const totalRefunds = entries.filter(e => e.type === 'Refund').reduce((sum, e) => sum + e.debit, 0)

    // Get opening balance (balance before the period)
    const openingEntry = await db.ledgerEntry.findFirst({
      where: {
        customerId: id,
        status: 'Active',
        createdAt: { lt: fromDate },
      },
      orderBy: { createdAt: 'desc' },
      select: { balance: true },
    })

    const openingBalance = openingEntry?.balance ?? customer.openingBalance ?? 0

    // Get closing balance (balance at end of period)
    const closingEntry = entries.length > 0 ? entries[entries.length - 1] : null
    const closingBalance = closingEntry?.balance ?? openingBalance

    // Return flat structure matching frontend expectations
    // Frontend accesses: stmtData.entries, stmtData.openingBalance, 
    //   stmtData.totalDebits, stmtData.totalCredits, stmtData.closingBalance
    return NextResponse.json({
      period: { from: from || '', to: to || '' },
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        mobile: customer.mobile,
        email: customer.email,
        customerType: customer.customerType,
        tags: customer.tags.map(t => t.tagName),
      },
      openingBalance,
      closingBalance,
      totalDebits: totalCharges,
      totalCredits: totalPayments,
      totalTax,
      totalDiscount,
      totalSettlements,
      totalRefunds,
      entryCount: entries.length,
      settlementCount: settlements.length,
      entries,
      settlements,
    })
  } catch (error) {
    console.error('Error generating customer statement:', error)
    return NextResponse.json({ error: 'Failed to generate customer statement' }, { status: 500 })
  }
}
