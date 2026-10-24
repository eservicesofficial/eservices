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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const invoiceWhere: Record<string, unknown> = { unitCode: session.unitCode }
    if (startDate && endDate) {
      invoiceWhere.date = { gte: startDate, lte: endDate }
    } else if (startDate) {
      invoiceWhere.date = { gte: startDate }
    } else if (endDate) {
      invoiceWhere.date = { lte: endDate }
    }

    const pettyCashWhere: Record<string, unknown> = { unitCode: session.unitCode }
    if (startDate && endDate) {
      pettyCashWhere.date = { gte: startDate, lte: endDate }
    } else if (startDate) {
      pettyCashWhere.date = { gte: startDate }
    } else if (endDate) {
      pettyCashWhere.date = { lte: endDate }
    }

    const attendanceWhere: Record<string, unknown> = { profile: { unitCode: session.unitCode } }
    if (startDate && endDate) {
      attendanceWhere.date = { gte: startDate, lte: endDate }
    } else if (startDate) {
      attendanceWhere.date = { gte: startDate }
    } else if (endDate) {
      attendanceWhere.date = { lte: endDate }
    }

    const [invoices, pettyCashTransactions, attendanceRecords] = await Promise.all([
      db.invoice.findMany({
        where: invoiceWhere,
      }),
      db.pettyCashTransaction.findMany({
        where: pettyCashWhere,
      }),
      db.attendance.findMany({
        where: attendanceWhere,
      }),
    ])

    // Active invoices = excluding refunded, cancelled, replaced
    const activeInvoices = invoices.filter((inv) => {
      const s = (inv.status || '').toLowerCase()
      return s !== 'refunded' && s !== 'cancelled' && s !== 'replaced'
    })

    // Replaced invoices use paidAmount for revenue
    const replacedInvoices = invoices.filter((inv) => (inv.status || '').toLowerCase() === 'replaced')

    // Revenue totals — active invoices use grandTotal, replaced use paidAmount
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0)
      + replacedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
    const totalSubtotal = activeInvoices.reduce((sum, inv) => sum + inv.subtotal, 0)
    const totalCgst = activeInvoices.reduce((sum, inv) => sum + inv.cgst, 0)
    const totalSgst = activeInvoices.reduce((sum, inv) => sum + inv.sgst, 0)
    const totalDelivery = activeInvoices.reduce((sum, inv) => sum + inv.deliveryCharge, 0)
    const completedInvoices = activeInvoices.filter((inv) => inv.isCompleted)
    const pendingInvoices = activeInvoices.filter((inv) => !inv.isCompleted)

    const cashPayments = activeInvoices.filter((inv) => inv.paymentMethod === 'Cash')
    const cashTotal = cashPayments.reduce((sum, inv) => sum + inv.grandTotal, 0)

    // Separate tracking for refunded/replaced/cancelled
    const refundedAmount = invoices.filter(inv => (inv.status || '').toLowerCase() === 'refunded').reduce((sum, inv) => sum + inv.grandTotal, 0)
    const replacedAmount = invoices.filter(inv => (inv.status || '').toLowerCase() === 'replaced').reduce((sum, inv) => sum + inv.grandTotal, 0)
    const cancelledAmount = invoices.filter(inv => (inv.status || '').toLowerCase() === 'cancelled').reduce((sum, inv) => sum + inv.grandTotal, 0)

    const pettyIncome = pettyCashTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
    const pettyExpense = pettyCashTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const presentCount = attendanceRecords.filter((a) => a.status === 'present').length
    const absentCount = attendanceRecords.filter((a) => a.status === 'absent').length
    const leaveCount = attendanceRecords.filter((a) => a.status === 'leave').length

    return NextResponse.json({
      invoices: {
        total: invoices.length,
        activeTotal: activeInvoices.length + replacedInvoices.length,
        completed: completedInvoices.length,
        pending: pendingInvoices.length,
        totalRevenue,
        totalSubtotal,
        totalCgst,
        totalSgst,
        totalDelivery,
        refundedAmount,
        replacedAmount,
        cancelledAmount,
      },
      cashSummary: {
        cashTotal,
        cashCount: cashPayments.length,
      },
      pettyCash: {
        income: pettyIncome,
        expense: pettyExpense,
        net: pettyIncome - pettyExpense,
        transactionCount: pettyCashTransactions.length,
      },
      attendance: {
        total: attendanceRecords.length,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
      },
    })
  } catch (error) {
    console.error('Error generating reports:', error)
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 })
  }
}
