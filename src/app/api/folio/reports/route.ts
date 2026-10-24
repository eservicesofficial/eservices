import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// ─── Report Types ───
type ReportType =
  | 'summary' | 'outstanding' | 'payments' | 'transactions' | 'vip' | 'settlements' | 'refunds' | 'gst'
  | 'activeFolio' | 'checkoutHistory' | 'creditBalance' | 'chargeSummary'
  | 'discounts' | 'userCollections' | 'dailyCollections' | 'monthlyCollections' | 'audit'

const VALID_REPORT_TYPES: ReportType[] = [
  'summary', 'outstanding', 'payments', 'transactions', 'vip', 'settlements', 'refunds', 'gst',
  'activeFolio', 'checkoutHistory', 'creditBalance', 'chargeSummary',
  'discounts', 'userCollections', 'dailyCollections', 'monthlyCollections', 'audit',
]

// ─── Filter Interface ───
interface ReportFilters {
  fromDate: Date | null
  toDate: Date | null
  customer: string | null
  folioNumber: string | null
  user: string | null
  status: string | null
  paymentType: string | null
  paymentMode: string | null
  transactionType: string | null
  dateFilter: Record<string, Date> | undefined
}

function parseFilters(searchParams: URLSearchParams): ReportFilters {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const fromDate = from ? new Date(from) : null
  let toDate: Date | null = to ? new Date(to) : null
  if (toDate) toDate.setHours(23, 59, 59, 999)

  const dateFilter: Record<string, Date> | undefined =
    fromDate && toDate ? { gte: fromDate, lte: toDate } :
    fromDate ? { gte: fromDate } :
    toDate ? { lte: toDate } :
    undefined

  // transactionType is alias for paymentType
  const paymentType = searchParams.get('paymentType') || searchParams.get('transactionType') || null

  return {
    fromDate,
    toDate,
    customer: searchParams.get('customer') || null,
    folioNumber: searchParams.get('folioNumber') || null,
    user: searchParams.get('user') || null,
    status: searchParams.get('status') || null,
    paymentType,
    paymentMode: searchParams.get('paymentMode') || null,
    transactionType: paymentType,
    dateFilter,
  }
}

// Helper: apply common ledger entry filters
function applyLedgerFilters(where: Record<string, unknown>, filters: ReportFilters, unitCode: string) {
  where.unitCode = unitCode
  if (filters.dateFilter) where.createdAt = filters.dateFilter
  if (filters.customer) {
    where.OR = [
      { customer: { fullName: { contains: filters.customer } } },
      { customer: { customerId: { contains: filters.customer } } },
      { customer: { mobile: { contains: filters.customer } } },
    ] as any[]
  }
  if (filters.paymentType && filters.paymentType !== 'All') where.type = filters.paymentType
  if (filters.paymentMode && filters.paymentMode !== 'All') where.paymentMode = filters.paymentMode
  if (filters.user) where.userName = { contains: filters.user }
}

// Helper: apply common customer filters
function applyCustomerFilters(where: Record<string, unknown>, filters: ReportFilters, unitCode: string) {
  where.unitCode = unitCode
  if (filters.status && filters.status !== 'All') where.status = filters.status
  if (filters.customer) {
    where.OR = [
      { fullName: { contains: filters.customer } },
      { customerId: { contains: filters.customer } },
      { mobile: { contains: filters.customer } },
    ] as any[]
  }
}

// Helper: get balance for a set of customer IDs
async function getCustomerBalances(customerIds: string[], folioStatus?: string) {
  const folioWhere: Record<string, unknown> = { customerId: { in: customerIds }, status: folioStatus || 'Active' }
  const activeFolioIds = await db.folio.findMany({
    where: folioWhere,
    select: { id: true, customerId: true },
  })
  const folioIdSet = activeFolioIds.map(f => f.id)
  if (folioIdSet.length === 0) return new Map<string, { balance: number; date: string | null }>()

  // Use a two-step approach: get max createdAt per customerId, then fetch those rows
  // This avoids the unreliable distinct+orderBy pattern in SQLite
  const maxDates = await db.ledgerEntry.groupBy({
    by: ['customerId'],
    where: { folioId: { in: folioIdSet }, status: 'Active', customerId: { in: customerIds } },
    _max: { createdAt: true },
  })
  const customerMaxDate = new Map(maxDates.map(m => [m.customerId, m._max.createdAt]))
  if (customerMaxDate.size === 0) return new Map<string, { balance: number; date: string | null }>()

  // Fetch the actual ledger entries that match the max dates
  const latestEntries = await db.ledgerEntry.findMany({
    where: {
      folioId: { in: folioIdSet },
      status: 'Active',
      customerId: { in: customerIds },
    },
    select: { customerId: true, balance: true, createdAt: true },
  })

  // Pick only the entries that match the max date per customer
  const result = new Map<string, { balance: number; date: string | null }>()
  for (const entry of latestEntries) {
    const maxDate = customerMaxDate.get(entry.customerId)
    if (maxDate && entry.createdAt && entry.createdAt.getTime() === maxDate.getTime()) {
      if (!result.has(entry.customerId)) {
        result.set(entry.customerId, { balance: entry.balance, date: entry.createdAt?.toISOString() ?? null })
      }
    }
  }
  return result
}

// ─── GET Handler ───
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ReportType | null

    if (!type || !VALID_REPORT_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid or missing report type', validTypes: VALID_REPORT_TYPES }, { status: 400 })
    }

    const filters = parseFilters(searchParams)

    switch (type) {
      case 'summary': return handleSummary(session.unitCode, filters)
      case 'outstanding': return handleOutstanding(session.unitCode, filters)
      case 'payments': return handlePayments(session.unitCode, filters)
      case 'transactions': return handleTransactions(session.unitCode, filters)
      case 'vip': return handleVip(session.unitCode, filters)
      case 'settlements': return handleSettlements(session.unitCode, filters)
      case 'refunds': return handleRefunds(session.unitCode, filters)
      case 'gst': return handleGst(session.unitCode, filters)
      case 'activeFolio': return handleActiveFolio(session.unitCode, filters)
      case 'checkoutHistory': return handleCheckoutHistory(session.unitCode, filters)
      case 'creditBalance': return handleCreditBalance(session.unitCode, filters)
      case 'chargeSummary': return handleChargeSummary(session.unitCode, filters)
      case 'discounts': return handleDiscounts(session.unitCode, filters)
      case 'userCollections': return handleUserCollections(session.unitCode, filters)
      case 'dailyCollections': return handleDailyCollections(session.unitCode, filters)
      case 'monthlyCollections': return handleMonthlyCollections(session.unitCode, filters)
      case 'audit': return handleAudit(session.unitCode, filters)
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('[FolioReports] Error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXISTING REPORTS (enhanced with filters)
// ═══════════════════════════════════════════════════════════════════

// ─── 1. Customer Summary Report ───
async function handleSummary(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = {}
  applyCustomerFilters(where, filters, unitCode)

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, creditLimit: true, status: true, gstNumber: true,
      openingBalance: true, createdAt: true,
      tags: { select: { tagName: true } },
      _count: { select: { folios: true, ledgerEntries: true, settlements: true, visits: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const customerIds = customers.map(c => c.id)
  const ledgerMap = await getCustomerBalances(customerIds)

  const rows = customers.map(c => {
    const ledger = ledgerMap.get(c.id)
    const balance = ledger?.balance ?? 0
    return {
      customerId: c.customerId,
      fullName: c.fullName,
      mobile: c.mobile,
      email: c.email,
      customerType: c.customerType,
      status: c.status,
      balance,
      creditLimit: c.creditLimit,
      gstNumber: c.gstNumber,
      totalVisits: c._count.visits,
      totalTransactions: c._count.ledgerEntries,
      totalSettlements: c._count.settlements,
      tags: c.tags.map(t => t.tagName),
      createdAt: c.createdAt.toISOString(),
      lastTxnDate: ledger?.date ?? null,
    }
  })

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const totalCreditLimit = rows.reduce((s, r) => s + r.creditLimit, 0)
  const totalOutstanding = rows.filter(r => r.balance > 0).reduce((s, r) => s + r.balance, 0)
  const outstandingCount = rows.filter(r => r.balance > 0).length

  return NextResponse.json({
    reportType: 'summary',
    summary: {
      totalCustomers: rows.length,
      totalBalance,
      totalCreditLimit,
      totalOutstanding,
      outstandingCount,
      activeCount: rows.filter(r => r.status === 'Active').length,
      settledCount: rows.filter(r => r.status === 'Settled').length,
    },
    data: rows,
  })
}

// ─── 2. Outstanding Balance Report ───
async function handleOutstanding(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: { notIn: ['Archived', 'CheckedOut'] } }
  applyCustomerFilters(where, filters, unitCode)

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, creditLimit: true, status: true,
      tags: { select: { tagName: true } },
      _count: { select: { ledgerEntries: true, settlements: true, visits: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const customerIds = customers.map(c => c.id)
  const ledgerMap = await getCustomerBalances(customerIds)

  const rows = customers
    .map(c => {
      const balance = ledgerMap.get(c.id)?.balance ?? 0
      return {
        customerId: c.customerId,
        fullName: c.fullName,
        mobile: c.mobile,
        email: c.email,
        customerType: c.customerType,
        status: c.status,
        balance,
        creditLimit: c.creditLimit,
        overdue: balance > c.creditLimit,
        tags: c.tags.map(t => t.tagName),
        lastTxnDate: ledgerMap.get(c.id)?.date ?? null,
      }
    })
    .filter(r => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)
  const avgOutstanding = rows.length > 0 ? totalOutstanding / rows.length : 0

  return NextResponse.json({
    reportType: 'outstanding',
    summary: {
      totalCustomersWithDue: rows.length,
      totalOutstanding,
      avgOutstanding: Math.round(avgOutstanding * 100) / 100,
      highRiskCount: rows.filter(r => r.overdue).length,
    },
    data: rows,
  })
}

// ─── 3. Payment Collection Report ───
async function handlePayments(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Payment' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, description: true, credit: true, balance: true,
      paymentMode: true, userName: true, customerId: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true, mobile: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    mobile: e.customer.mobile,
    description: e.description,
    amount: e.credit,
    paymentMode: e.paymentMode,
    balanceAfter: e.balance,
    recordedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalPayments = rows.reduce((s, r) => s + r.amount, 0)
  const modeBreakdown = rows.reduce((acc: Record<string, number>, r) => {
    const mode = r.paymentMode || 'Cash'
    acc[mode] = (acc[mode] || 0) + r.amount
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'payments',
    summary: {
      totalPayments,
      paymentCount: rows.length,
      avgPayment: rows.length > 0 ? Math.round((totalPayments / rows.length) * 100) / 100 : 0,
      modeBreakdown,
    },
    data: rows,
  })
}

// ─── 4. Transaction History Report ───
async function handleTransactions(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, type: true, description: true, docNo: true, invoiceNo: true,
      debit: true, credit: true, tax: true, discount: true, balance: true,
      paymentMode: true, userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    type: e.type,
    description: e.description,
    docNo: e.docNo,
    invoiceNo: e.invoiceNo,
    debit: e.debit,
    credit: e.credit,
    tax: e.tax,
    discount: e.discount,
    balance: e.balance,
    paymentMode: e.paymentMode,
    recordedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalDebits = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredits = rows.reduce((s, r) => s + r.credit, 0)
  const totalTax = rows.reduce((s, r) => s + r.tax, 0)
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0)

  const typeBreakdown = rows.reduce((acc: Record<string, { count: number; debit: number; credit: number }>, r) => {
    if (!acc[r.type]) acc[r.type] = { count: 0, debit: 0, credit: 0 }
    acc[r.type].count++
    acc[r.type].debit += r.debit
    acc[r.type].credit += r.credit
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'transactions',
    summary: {
      totalEntries: rows.length,
      totalDebits,
      totalCredits,
      totalTax,
      totalDiscount,
      netFlow: totalCredits - totalDebits,
      typeBreakdown,
    },
    data: rows,
  })
}

// ─── 5. VIP Customer Report ───
async function handleVip(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = {
    OR: [
      { customerType: 'VIP' },
      { tags: { some: { tagName: 'VIP' } } },
      { tags: { some: { tagName: 'Premium' } } },
    ],
  }
  applyCustomerFilters(where, filters, unitCode)

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, creditLimit: true, status: true, gstNumber: true,
      panNumber: true, openingBalance: true, createdAt: true,
      tags: { select: { tagName: true } },
      _count: { select: { folios: true, ledgerEntries: true, settlements: true, visits: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const customerIds = customers.map(c => c.id)
  const ledgerMap = await getCustomerBalances(customerIds)

  const lifetimeSpend = customerIds.length > 0
    ? await db.ledgerEntry.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds }, status: 'Active', type: 'Charge' },
        _sum: { debit: true },
      })
    : []
  const spendMap = new Map(lifetimeSpend.map(l => [l.customerId, l._sum.debit ?? 0]))

  const rows = customers.map(c => {
    const balance = ledgerMap.get(c.id)?.balance ?? 0
    const lifetimeSpendAmt = spendMap.get(c.id) ?? 0
    return {
      customerId: c.customerId,
      fullName: c.fullName,
      mobile: c.mobile,
      email: c.email,
      customerType: c.customerType,
      status: c.status,
      balance,
      creditLimit: c.creditLimit,
      gstNumber: c.gstNumber,
      panNumber: c.panNumber,
      lifetimeSpend: lifetimeSpendAmt,
      totalVisits: c._count.visits,
      totalTransactions: c._count.ledgerEntries,
      totalSettlements: c._count.settlements,
      tags: c.tags.map(t => t.tagName),
      createdAt: c.createdAt.toISOString(),
      lastTxnDate: ledgerMap.get(c.id)?.date ?? null,
    }
  })

  const totalLifetimeSpend = rows.reduce((s, r) => s + r.lifetimeSpend, 0)
  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)

  return NextResponse.json({
    reportType: 'vip',
    summary: {
      totalVipCustomers: rows.length,
      totalLifetimeSpend,
      totalOutstanding,
      avgLifetimeSpend: rows.length > 0 ? Math.round((totalLifetimeSpend / rows.length) * 100) / 100 : 0,
      activeVipCount: rows.filter(r => r.status === 'Active').length,
    },
    data: rows,
  })
}

// ─── 6. Settlement Report ───
async function handleSettlements(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { unitCode }
  if (filters.dateFilter) where.createdAt = filters.dateFilter
  if (filters.customer) {
    where.OR = [
      { customer: { fullName: { contains: filters.customer } } },
      { customer: { customerId: { contains: filters.customer } } },
    ] as any[]
  }
  if (filters.paymentMode && filters.paymentMode !== 'All') where.mode = filters.paymentMode
  if (filters.user) where.userName = { contains: filters.user }

  const settlements = await db.settlement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, amount: true, mode: true, reference: true, description: true,
      userName: true, createdAt: true, folioId: true,
      customer: { select: { fullName: true, customerId: true, mobile: true } },
    },
    take: 5000,
  })

  const rows = settlements.map(s => ({
    date: s.createdAt.toISOString(),
    customerName: s.customer.fullName,
    customerId: s.customer.customerId,
    mobile: s.customer.mobile,
    amount: s.amount,
    mode: s.mode,
    reference: s.reference,
    description: s.description,
    recordedBy: s.userName,
    folioId: s.folioId,
  }))

  const totalSettled = rows.reduce((s, r) => s + r.amount, 0)
  const modeBreakdown = rows.reduce((acc: Record<string, number>, r) => {
    const mode = r.mode || 'Cash'
    acc[mode] = (acc[mode] || 0) + r.amount
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'settlements',
    summary: {
      totalSettlements: rows.length,
      totalSettled,
      avgSettlement: rows.length > 0 ? Math.round((totalSettled / rows.length) * 100) / 100 : 0,
      modeBreakdown,
    },
    data: rows,
  })
}

// ─── 7. Refund Report ───
async function handleRefunds(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Refund' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, description: true, debit: true, balance: true,
      invoiceNo: true, userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true, mobile: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    mobile: e.customer.mobile,
    description: e.description,
    refundAmount: e.debit,
    balanceAfter: e.balance,
    invoiceNo: e.invoiceNo,
    processedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalRefunds = rows.reduce((s, r) => s + r.refundAmount, 0)

  return NextResponse.json({
    reportType: 'refunds',
    summary: {
      totalRefunds: rows.length,
      totalRefundAmount: totalRefunds,
      avgRefund: rows.length > 0 ? Math.round((totalRefunds / rows.length) * 100) / 100 : 0,
    },
    data: rows,
  })
}

// ─── 8. GST / Tax Report ───
async function handleGst(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', tax: { gt: 0 } }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, type: true, description: true, debit: true, credit: true,
      tax: true, discount: true, balance: true, invoiceNo: true, paymentMode: true,
      userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true, gstNumber: true, mobile: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    customerGst: e.customer.gstNumber,
    type: e.type,
    description: e.description,
    invoiceNo: e.invoiceNo,
    baseAmount: (e.type === 'Payment' || e.type === 'Settlement') ? e.credit : e.debit,
    tax: e.tax,
    discount: e.discount,
    totalAmount: (e.type === 'Payment' || e.type === 'Settlement')
      ? e.credit
      : e.debit + e.tax - e.discount,
    balance: e.balance,
    recordedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalBaseAmount = rows.filter(r => r.type !== 'Payment' && r.type !== 'Settlement').reduce((s, r) => s + r.baseAmount, 0)
  const totalTax = rows.reduce((s, r) => s + r.tax, 0)
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0)
  const taxableEntries = rows.filter(r => r.type !== 'Payment' && r.type !== 'Settlement' && r.type !== 'Refund' && r.type !== 'Opening' && r.type !== 'Transfer')

  return NextResponse.json({
    reportType: 'gst',
    summary: {
      totalEntries: rows.length,
      totalTaxableEntries: taxableEntries.length,
      totalBaseAmount,
      totalTax,
      totalDiscount,
      totalGstAmount: totalBaseAmount + totalTax,
      avgTaxPerEntry: taxableEntries.length > 0 ? Math.round((totalTax / taxableEntries.length) * 100) / 100 : 0,
    },
    data: rows,
  })
}

// ═══════════════════════════════════════════════════════════════════
// NEW REPORTS (9 new types)
// ═══════════════════════════════════════════════════════════════════

// ─── 9. Active Folio Report ───
async function handleActiveFolio(unitCode: string, filters: ReportFilters) {
  const customerWhere: Record<string, unknown> = { status: 'Active' }
  applyCustomerFilters(customerWhere, filters, unitCode)

  const customers = await db.customer.findMany({
    where: customerWhere,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, creditLimit: true, status: true,
      _count: { select: { ledgerEntries: true, folios: true, visits: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const customerIds = customers.map(c => c.id)

  // Get active folios with their details
  const foliosWhere: Record<string, unknown> = { customerId: { in: customerIds }, status: 'Active' }
  if (filters.folioNumber) foliosWhere.folioNumber = parseInt(filters.folioNumber, 10) || undefined
  const folios = await db.folio.findMany({
    where: foliosWhere,
    select: {
      id: true, folioId: true, folioNumber: true, customerId: true, visitNumber: true,
      status: true, createdAt: true,
      _count: { select: { ledgerEntries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const folioIds = folios.map(f => f.id)
  // Use groupBy to reliably get the latest entry per folio (avoids distinct+orderBy issues in SQLite)
  const folioBalanceMap = new Map<string, { balance: number; date: string | null }>()
  if (folioIds.length > 0) {
    const maxDates = await db.ledgerEntry.groupBy({
      by: ['folioId'],
      where: { folioId: { in: folioIds }, status: 'Active' },
      _max: { createdAt: true },
    })
    const folioMaxDate = new Map(maxDates.map(m => [m.folioId, m._max.createdAt]))
    const latestEntries = await db.ledgerEntry.findMany({
      where: { folioId: { in: folioIds }, status: 'Active' },
      select: { folioId: true, balance: true, createdAt: true },
    })
    for (const entry of latestEntries) {
      const maxDate = folioMaxDate.get(entry.folioId)
      if (maxDate && entry.createdAt && entry.createdAt.getTime() === maxDate.getTime()) {
        if (!folioBalanceMap.has(entry.folioId)) {
          folioBalanceMap.set(entry.folioId, { balance: entry.balance, date: entry.createdAt?.toISOString() ?? null })
        }
      }
    }
  }

  const customerMap = new Map(customers.map(c => [c.id, c]))

  const rows = folios.map(f => {
    const cust = customerMap.get(f.customerId)
    const bal = folioBalanceMap.get(f.id)
    return {
      customerId: cust?.customerId ?? '',
      fullName: cust?.fullName ?? '',
      mobile: cust?.mobile ?? '',
      customerType: cust?.customerType ?? '',
      folioId: f.folioId,
      folioNumber: f.folioNumber,
      visitNumber: f.visitNumber,
      status: f.status,
      balance: bal?.balance ?? 0,
      entryCount: f._count.ledgerEntries,
      lastTxnDate: bal?.date ?? null,
      folioCreatedAt: f.createdAt.toISOString(),
    }
  })

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)
  const activeFolioCount = rows.length

  return NextResponse.json({
    reportType: 'activeFolio',
    summary: {
      activeFolioCount,
      totalBalance,
      avgBalance: activeFolioCount > 0 ? Math.round((totalBalance / activeFolioCount) * 100) / 100 : 0,
      uniqueCustomers: new Set(rows.map(r => r.customerId)).size,
    },
    data: rows,
  })
}

// ─── 10. Checkout History Report ───
async function handleCheckoutHistory(unitCode: string, filters: ReportFilters) {
  const customerWhere: Record<string, unknown> = {}
  applyCustomerFilters(customerWhere, filters, unitCode)
  // Only show checked-out customers (or all if no status filter)
  if (!filters.status) customerWhere.status = 'CheckedOut'
  else if (filters.status === 'All') delete customerWhere.status

  const customers = await db.customer.findMany({
    where: customerWhere,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, status: true, createdAt: true,
      tags: { select: { tagName: true } },
      _count: { select: { ledgerEntries: true, folios: true, settlements: true, visits: true } },
      visits: {
        where: { checkOutAt: { not: null } },
        select: { checkInAt: true, checkOutAt: true },
        orderBy: { checkOutAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  })

  const customerIds = customers.map(c => c.id)
  const ledgerMap = await getCustomerBalances(customerIds, 'Settled')

  const rows = customers.map(c => {
    const lastVisit = c.visits[0]
    const bal = ledgerMap.get(c.id)
    return {
      customerId: c.customerId,
      fullName: c.fullName,
      mobile: c.mobile,
      email: c.email,
      customerType: c.customerType,
      status: c.status,
      finalBalance: bal?.balance ?? 0,
      totalVisits: c._count.visits,
      totalTransactions: c._count.ledgerEntries,
      totalSettlements: c._count.settlements,
      tags: c.tags.map(t => t.tagName),
      checkInDate: lastVisit?.checkInAt?.toISOString() ?? null,
      checkOutDate: lastVisit?.checkOutAt?.toISOString() ?? null,
      customerSince: c.createdAt.toISOString(),
    }
  })

  return NextResponse.json({
    reportType: 'checkoutHistory',
    summary: {
      totalCheckedOut: rows.length,
      totalWithBalance: rows.filter(r => r.finalBalance > 0).length,
      totalWithCredit: rows.filter(r => r.finalBalance < 0).length,
      avgVisits: rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.totalVisits, 0) / rows.length) * 100) / 100 : 0,
    },
    data: rows,
  })
}

// ─── 11. Credit Balance Report ───
async function handleCreditBalance(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = {}
  applyCustomerFilters(where, filters, unitCode)

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true, customerId: true, fullName: true, mobile: true, email: true,
      customerType: true, creditLimit: true, status: true,
      _count: { select: { ledgerEntries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const customerIds = customers.map(c => c.id)
  const ledgerMap = await getCustomerBalances(customerIds)

  const rows = customers
    .map(c => {
      const bal = ledgerMap.get(c.id)
      const balance = bal?.balance ?? 0
      return {
        customerId: c.customerId,
        fullName: c.fullName,
        mobile: c.mobile,
        email: c.email,
        customerType: c.customerType,
        status: c.status,
        creditBalance: Math.abs(balance),
        balance,
        totalTransactions: c._count.ledgerEntries,
        lastTxnDate: bal?.date ?? null,
      }
    })
    .filter(r => r.balance < 0)
    .sort((a, b) => a.balance - b.balance)

  const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0)

  return NextResponse.json({
    reportType: 'creditBalance',
    summary: {
      customersWithCredit: rows.length,
      totalCreditBalance: totalCredit,
      avgCredit: rows.length > 0 ? Math.round((totalCredit / rows.length) * 100) / 100 : 0,
    },
    data: rows,
  })
}

// ─── 12. Charge Summary Report ───
async function handleChargeSummary(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Charge' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, description: true, debit: true, tax: true, discount: true,
      balance: true, invoiceNo: true, userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    description: e.description,
    chargeAmount: e.debit,
    tax: e.tax,
    discount: e.discount,
    total: e.debit + e.tax - e.discount,
    balance: e.balance,
    invoiceNo: e.invoiceNo,
    recordedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalCharges = rows.reduce((s, r) => s + r.chargeAmount, 0)
  const totalTax = rows.reduce((s, r) => s + r.tax, 0)
  const totalDiscount = rows.reduce((s, r) => s + r.discount, 0)

  // Group by description for summary
  const descBreakdown = rows.reduce((acc: Record<string, { count: number; amount: number }>, r) => {
    const key = r.description || 'Miscellaneous'
    if (!acc[key]) acc[key] = { count: 0, amount: 0 }
    acc[key].count++
    acc[key].amount += r.chargeAmount
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'chargeSummary',
    summary: {
      totalCharges,
      totalTax,
      totalDiscount,
      grandTotal: totalCharges + totalTax - totalDiscount,
      chargeCount: rows.length,
      uniqueDescriptions: Object.keys(descBreakdown).length,
      topCharges: Object.entries(descBreakdown)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 5)
        .reduce((acc, [k, v]) => { acc[k] = v; return acc }, {} as Record<string, { count: number; amount: number }>),
    },
    data: rows,
  })
}

// ─── 13. Discount Report ───
async function handleDiscounts(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Discount' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, description: true, credit: true, balance: true,
      userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true, mobile: true } },
    },
    take: 5000,
  })

  const rows = entries.map(e => ({
    date: e.date,
    customerName: e.customer.fullName,
    customerId: e.customer.customerId,
    mobile: e.customer.mobile,
    description: e.description,
    discountAmount: e.credit,
    balanceAfter: e.balance,
    recordedBy: e.userName,
    createdAt: e.createdAt.toISOString(),
  }))

  const totalDiscount = rows.reduce((s, r) => s + r.discountAmount, 0)

  // Group by user
  const userBreakdown = rows.reduce((acc: Record<string, { count: number; total: number }>, r) => {
    const user = r.recordedBy || 'Unknown'
    if (!acc[user]) acc[user] = { count: 0, total: 0 }
    acc[user].count++
    acc[user].total += r.discountAmount
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'discounts',
    summary: {
      totalDiscounts: rows.length,
      totalDiscountAmount: totalDiscount,
      avgDiscount: rows.length > 0 ? Math.round((totalDiscount / rows.length) * 100) / 100 : 0,
      userBreakdown,
    },
    data: rows,
  })
}

// ─── 14. User-wise Collection Report ───
async function handleUserCollections(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Payment' }
  applyLedgerFilters(where, filters, unitCode)
  // user filter applied via applyLedgerFilters already

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, credit: true, paymentMode: true, userName: true, createdAt: true,
      customer: { select: { fullName: true, customerId: true } },
    },
    take: 5000,
  })

  // Group by user
  const userGroups = new Map<string, {
    userName: string
    payments: typeof entries
    totalAmount: number
    count: number
    modeBreakdown: Record<string, number>
  }>()

  for (const e of entries) {
    const user = e.userName || 'Unknown'
    if (!userGroups.has(user)) {
      userGroups.set(user, { userName: user, payments: [], totalAmount: 0, count: 0, modeBreakdown: {} })
    }
    const group = userGroups.get(user)!
    group.payments.push(e)
    group.totalAmount += e.credit
    group.count++
    const mode = e.paymentMode || 'Cash'
    group.modeBreakdown[mode] = (group.modeBreakdown[mode] || 0) + e.credit
  }

  const rows = Array.from(userGroups.values()).map(g => ({
    userName: g.userName,
    totalCollected: g.totalAmount,
    paymentCount: g.count,
    avgCollection: g.count > 0 ? Math.round((g.totalAmount / g.count) * 100) / 100 : 0,
    modeBreakdown: g.modeBreakdown,
  })).sort((a, b) => b.totalCollected - a.totalCollected)

  const grandTotal = rows.reduce((s, r) => s + r.totalCollected, 0)

  return NextResponse.json({
    reportType: 'userCollections',
    summary: {
      totalUsers: rows.length,
      grandTotal,
      totalPayments: rows.reduce((s, r) => s + r.paymentCount, 0),
      avgPerUser: rows.length > 0 ? Math.round((grandTotal / rows.length) * 100) / 100 : 0,
    },
    data: rows,
  })
}

// ─── 15. Daily Collection Report ───
async function handleDailyCollections(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Payment' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, credit: true, paymentMode: true, userName: true, createdAt: true,
    },
    take: 10000,
  })

  // Group by date
  const dateGroups = new Map<string, {
    date: string
    totalAmount: number
    count: number
    modeBreakdown: Record<string, number>
  }>()

  for (const e of entries) {
    const dateKey = e.date || e.createdAt.toISOString().split('T')[0]
    if (!dateGroups.has(dateKey)) {
      dateGroups.set(dateKey, { date: dateKey, totalAmount: 0, count: 0, modeBreakdown: {} })
    }
    const group = dateGroups.get(dateKey)!
    group.totalAmount += e.credit
    group.count++
    const mode = e.paymentMode || 'Cash'
    group.modeBreakdown[mode] = (group.modeBreakdown[mode] || 0) + e.credit
  }

  const rows = Array.from(dateGroups.values()).sort((a, b) => b.date.localeCompare(a.date))

  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0)
  const bestDay = rows.length > 0 ? rows.reduce((best, r) => r.totalAmount > best.totalAmount ? r : best, rows[0]) : null

  return NextResponse.json({
    reportType: 'dailyCollections',
    summary: {
      totalDays: rows.length,
      grandTotal,
      avgDaily: rows.length > 0 ? Math.round((grandTotal / rows.length) * 100) / 100 : 0,
      bestDay: bestDay ? { date: bestDay.date, amount: bestDay.totalAmount } : null,
      totalPayments: rows.reduce((s, r) => s + r.count, 0),
    },
    data: rows,
  })
}

// ─── 16. Monthly Collection Report ───
async function handleMonthlyCollections(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { status: 'Active', type: 'Payment' }
  applyLedgerFilters(where, filters, unitCode)

  const entries = await db.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, date: true, credit: true, paymentMode: true, createdAt: true,
    },
    take: 10000,
  })

  // Group by month (YYYY-MM)
  const monthGroups = new Map<string, {
    month: string
    totalAmount: number
    count: number
    modeBreakdown: Record<string, number>
  }>()

  for (const e of entries) {
    const d = new Date(e.date || e.createdAt.toISOString())
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthGroups.has(monthKey)) {
      monthGroups.set(monthKey, { month: monthKey, totalAmount: 0, count: 0, modeBreakdown: {} })
    }
    const group = monthGroups.get(monthKey)!
    group.totalAmount += e.credit
    group.count++
    const mode = e.paymentMode || 'Cash'
    group.modeBreakdown[mode] = (group.modeBreakdown[mode] || 0) + e.credit
  }

  const rows = Array.from(monthGroups.values()).sort((a, b) => b.month.localeCompare(a.month))

  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0)
  const bestMonth = rows.length > 0 ? rows.reduce((best, r) => r.totalAmount > best.totalAmount ? r : best, rows[0]) : null

  return NextResponse.json({
    reportType: 'monthlyCollections',
    summary: {
      totalMonths: rows.length,
      grandTotal,
      avgMonthly: rows.length > 0 ? Math.round((grandTotal / rows.length) * 100) / 100 : 0,
      bestMonth: bestMonth ? { month: bestMonth.month, amount: bestMonth.totalAmount } : null,
      totalPayments: rows.reduce((s, r) => s + r.count, 0),
    },
    data: rows,
  })
}

// ─── 17. Audit Report ───
async function handleAudit(unitCode: string, filters: ReportFilters) {
  const where: Record<string, unknown> = { unitCode }
  if (filters.dateFilter) where.createdAt = filters.dateFilter
  if (filters.user) where.userName = { contains: filters.user }
  if (filters.customer) {
    // For audit, search in target or details or customerId
    where.OR = [
      { target: { contains: filters.customer } },
      { details: { contains: filters.customer } },
      { customerId: { contains: filters.customer } },
    ] as any[]
  }
  // Filter by action type (map paymentType to action where applicable)
  if (filters.paymentType && filters.paymentType !== 'All') {
    const actionMap: Record<string, string> = {
      Charge: 'Create', Payment: 'Create', Refund: 'Refund',
      Discount: 'Discount', Settlement: 'Settlement',
    }
    const action = actionMap[filters.paymentType]
    if (action) where.action = action
  }

  const logs = await db.folioAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, action: true, target: true, details: true,
      userName: true, ipAddress: true, device: true,
      customerId: true, folioId: true, createdAt: true,
    },
    take: 5000,
  })

  const rows = logs.map(l => {
    let detailsParsed: Record<string, any> = {}
    try { detailsParsed = l.details ? JSON.parse(l.details) : {} } catch { /* ignore */ }
    return {
      date: l.createdAt.toISOString(),
      action: l.action,
      target: l.target,
      userName: l.userName,
      customerId: l.customerId,
      folioId: l.folioId,
      details: detailsParsed,
      ipAddress: l.ipAddress,
      device: l.device,
    }
  })

  // Action breakdown
  const actionBreakdown = rows.reduce((acc: Record<string, number>, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    reportType: 'audit',
    summary: {
      totalLogs: rows.length,
      actionBreakdown,
      uniqueUsers: new Set(rows.map(r => r.userName).filter(Boolean)).size,
    },
    data: rows,
  })
}
