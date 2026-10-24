import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const paymentMethod = searchParams.get('paymentMethod') || ''
    const customerName = searchParams.get('customerName') || ''
    const statusFilter = searchParams.get('status') || 'All'

    const where: Record<string, unknown> = { unitCode: session.unitCode }
    if (startDate) where.date = { ...(where.date as Record<string, unknown>), gte: startDate }
    if (endDate) where.date = { ...(where.date as Record<string, unknown>), lte: endDate }
    if (paymentMethod && paymentMethod !== 'All') where.paymentMethod = paymentMethod
    if (customerName) where.customerName = { contains: customerName }
    if (statusFilter && statusFilter !== 'All') where.status = statusFilter

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })

    const transactions = invoices.map((inv) => ({
      invoiceNo: inv.invoiceNumber,
      date: inv.date,
      customerName: inv.customerName,
      paymentMethod: inv.paymentMethod,
      amount: inv.grandTotal,
      status: inv.status,
      paidAmount: inv.paidAmount || 0,
      balanceAmount: inv.balanceAmount || 0,
    }))

    // Active invoices = excluding refunded, cancelled, and replaced
    // (replaced invoices use paidAmount for revenue, handled separately)
    const activeInvoices = invoices.filter(
      (inv) => {
        const s = (inv.status || '').toLowerCase()
        return s !== 'refunded' && s !== 'cancelled' && s !== 'replaced'
      }
    )

    // Fully refunded/cancelled invoices
    const excludedInvoices = invoices.filter(
      (inv) => {
        const s = (inv.status || '').toLowerCase()
        return s === 'refunded' || s === 'cancelled'
      }
    )

    // Replaced invoices (use paidAmount for revenue)
    const replacedInvoices = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'replaced')

    // Revenue: active invoices use grandTotal, replaced invoices use paidAmount
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0)
      + replacedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)

    const codAmount = activeInvoices.filter((inv) => inv.paymentMethod === 'Cash').reduce((sum, inv) => sum + inv.grandTotal, 0)
      + replacedInvoices.filter((inv) => inv.paymentMethod === 'Cash').reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)

    const onlineAmount = activeInvoices.filter((inv) => inv.paymentMethod !== 'Cash').reduce((sum, inv) => sum + inv.grandTotal, 0)
      + replacedInvoices.filter((inv) => inv.paymentMethod !== 'Cash').reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)

    // Separate tracking for refunded/replaced amounts
    const refundedAmount = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'refunded').reduce((sum, inv) => sum + inv.grandTotal, 0)
    const replacedAmount = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'replaced').reduce((sum, inv) => sum + inv.grandTotal, 0)
    const cancelledAmount = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'cancelled').reduce((sum, inv) => sum + inv.grandTotal, 0)

    // Balance due from active invoices only (excluded replaced — their balance is forgiven)
    const totalBalanceDue = activeInvoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0)

    // Pending bills count (active invoices with pending or balance status)
    const pendingBills = activeInvoices.filter((inv) => (inv.status || '').toLowerCase() === 'pending' || (inv.status || '').toLowerCase() === 'balance').length

    // Total orders includes replaced invoices
    const totalOrders = activeInvoices.length + replacedInvoices.length

    return NextResponse.json({
      transactions,
      totalRevenue,
      codAmount,
      onlineAmount,
      totalOrders,
      refundedAmount,
      replacedAmount,
      cancelledAmount,
      excludedTotal: refundedAmount + replacedAmount + cancelledAmount,
      totalBalanceDue,
      pendingBills,
      excludedCount: excludedInvoices.length + replacedInvoices.length,
    })
  } catch (error) {
    console.error('Error fetching invoice reports:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice reports' }, { status: 500 })
  }
}
