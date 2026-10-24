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

    if (!sessionHasPermission(session, 'customerFolio', 'access')) {
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
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const singleFolioId = searchParams.get('folioId') // P4: Support filtering by a single folio

    // Default date range: from beginning of time to now
    const fromDate = from ? new Date(from) : new Date('2020-01-01')
    const toDate = to ? new Date(to) : new Date()
    toDate.setHours(23, 59, 59, 999)

    // Get folio IDs — smart logic when includeArchived is set:
    // If active folios exist → only use those (normal operation).
    // If NO active folios (e.g. CheckedOut customer) → fall back to all folios
    // so the invoice/receipt still shows the last checkout's transactions.
    const allCustomerFolios = await db.folio.findMany({
      where: { customerId: id },
      select: { id: true, status: true },
    })

    let folioIdList: string[]
    // P4: If a specific folioId is requested, use only that folio
    if (singleFolioId) {
      const match = allCustomerFolios.find(f => f.id === singleFolioId)
      folioIdList = match ? [match.id] : [singleFolioId]
    } else if (includeArchived) {
      const hasActive = allCustomerFolios.some(f => f.status === 'Active')
      folioIdList = hasActive
        ? allCustomerFolios.filter(f => f.status === 'Active').map(f => f.id)
        : allCustomerFolios.map(f => f.id)
    } else {
      folioIdList = allCustomerFolios.filter(f => f.status === 'Active').map(f => f.id)
    }

    // Get all ledger entries within date range (only Active entries from selected folios)
    const where: Record<string, unknown> = {
      customerId: id,
      folioId: { in: folioIdList },
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

    // Get opening balance: unified balance across selected folios before the period
    const prePeriodEntries = await db.ledgerEntry.findMany({
      where: {
        customerId: id,
        folioId: { in: folioIdList },
        status: 'Active',
        createdAt: { lt: fromDate },
      },
      orderBy: { createdAt: 'asc' },
      select: { debit: true, credit: true },
    })
    let unifiedOpeningBalance = customer.openingBalance ?? 0
    for (const e of prePeriodEntries) {
      unifiedOpeningBalance = unifiedOpeningBalance + (e.debit || 0) - (e.credit || 0)
    }

    // Recalculate unified running balance across ALL folios for entries in this period
    const unifiedEntries = entries.map(e => ({ ...e, balance: 0 as number }))
    let runningBalance = unifiedOpeningBalance
    for (const entry of unifiedEntries) {
      runningBalance = runningBalance + (entry.debit || 0) - (entry.credit || 0)
      entry.balance = Math.round(runningBalance * 100) / 100
    }

    // P4: Get folio number for proforma printing
    let folioNumber: number | undefined
    if (singleFolioId) {
      const folioWithNumber = await db.folio.findUnique({
        where: { id: singleFolioId },
        select: { folioNumber: true },
      })
      folioNumber = folioWithNumber?.folioNumber ?? undefined
    }

    const closingBalance = Math.round((unifiedEntries.length > 0 ? unifiedEntries[unifiedEntries.length - 1].balance : unifiedOpeningBalance) * 100) / 100

    return NextResponse.json({
      period: { from: from || '', to: to || '' },
      folioId: singleFolioId || '', // P4: Pass folioId for proforma printing
      folioNumber, // P4: Pass folioNumber for correct proforma display
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        mobile: customer.mobile,
        email: customer.email,
        customerType: customer.customerType,
        tags: customer.tags.map(t => t.tagName),
      },
      openingBalance: unifiedOpeningBalance,
      closingBalance,
      totalDebits: totalCharges,
      totalCredits: totalPayments,
      totalTax,
      totalDiscount,
      totalSettlements,
      totalRefunds,
      entryCount: unifiedEntries.length,
      settlementCount: settlements.length,
      entries: unifiedEntries,
      settlements,
    })
  } catch (error) {
    console.error('Error generating customer statement:', error)
    return NextResponse.json({ error: 'Failed to generate customer statement' }, { status: 500 })
  }
}
