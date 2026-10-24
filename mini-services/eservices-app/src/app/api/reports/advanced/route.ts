import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    const invoiceWhere: Record<string, unknown> = { unitCode: session.unitCode };
    if (startDate && endDate) {
      invoiceWhere.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      invoiceWhere.date = { gte: startDate };
    } else if (endDate) {
      invoiceWhere.date = { lte: endDate };
    }

    const pettyCashWhere: Record<string, unknown> = { unitCode: session.unitCode };
    if (startDate && endDate) {
      pettyCashWhere.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      pettyCashWhere.date = { gte: startDate };
    } else if (endDate) {
      pettyCashWhere.date = { lte: endDate };
    }

    const refundWhere: Record<string, unknown> = { unitCode: session.unitCode };
    if (startDate && endDate) {
      refundWhere.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      refundWhere.date = { gte: startDate };
    } else if (endDate) {
      refundWhere.date = { lte: endDate };
    }

    switch (type) {
      case 'overview': {
        const [invoices, pettyCashTxns] = await Promise.all([
          db.invoice.findMany({ where: invoiceWhere, include: { invoiceItems: true } }),
          db.pettyCashTransaction.findMany({ where: pettyCashWhere }),
        ]);

        const active = invoices.filter((i) => !['refunded', 'cancelled'].includes((i.status || '').toLowerCase()));
        const totalRevenue = active.reduce((s, i) => s + i.grandTotal, 0);
        const totalPaid = active.reduce((s, i) => s + (i.paidAmount || 0), 0);
        const totalBalance = active.reduce((s, i) => s + (i.balanceAmount || 0), 0);
        const totalDiscount = invoices.reduce((s, i) => s + (i.discountAmount || 0), 0);
        const totalDelivery = invoices.reduce((s, i) => s + (i.deliveryCharge || 0), 0);
        const totalGST = invoices.reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0), 0);

        const pettyIncome = pettyCashTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const pettyExpense = pettyCashTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        // Daily revenue breakdown
        const dailyMap: Record<string, number> = {};
        active.forEach((inv) => {
          dailyMap[inv.date] = (dailyMap[inv.date] || 0) + inv.grandTotal;
        });
        const dailyRevenue = Object.entries(dailyMap)
          .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Payment method breakdown
        const paymentMap: Record<string, { count: number; total: number }> = {};
        active.forEach((inv) => {
          const method = inv.paymentMethod || 'Cash';
          if (!paymentMap[method]) paymentMap[method] = { count: 0, total: 0 };
          paymentMap[method].count++;
          paymentMap[method].total += inv.grandTotal;
        });

        return NextResponse.json({
          totalInvoices: invoices.length,
          activeInvoices: active.length,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalBalance: Math.round(totalBalance * 100) / 100,
          totalDiscount: Math.round(totalDiscount * 100) / 100,
          totalDelivery: Math.round(totalDelivery * 100) / 100,
          totalGST: Math.round(totalGST * 100) / 100,
          pettyIncome: Math.round(pettyIncome * 100) / 100,
          pettyExpense: Math.round(pettyExpense * 100) / 100,
          dailyRevenue,
          paymentBreakdown: Object.entries(paymentMap).map(([method, data]) => ({
            method,
            count: data.count,
            total: Math.round(data.total * 100) / 100,
          })),
        });
      }

      case 'balance': {
        const invoices = await db.invoice.findMany({
          where: { ...invoiceWhere, status: 'Balance' },
          include: { invoiceItems: true },
          orderBy: { date: 'desc' },
        });

        const totalBalance = invoices.reduce((s, i) => s + (i.balanceAmount || 0), 0);
        const totalGrandTotal = invoices.reduce((s, i) => s + i.grandTotal, 0);
        const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);

        return NextResponse.json({
          totalBills: invoices.length,
          totalBalanceAmount: Math.round(totalBalance * 100) / 100,
          totalGrandTotal: Math.round(totalGrandTotal * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          bills: invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            customerName: inv.customerName,
            grandTotal: inv.grandTotal,
            paidAmount: inv.paidAmount || 0,
            balanceAmount: inv.balanceAmount || 0,
            paymentMethod: inv.paymentMethod,
            orderType: inv.orderType,
          })),
        });
      }

      case 'refunds': {
        const refunds = await db.refund.findMany({
          where: refundWhere,
          include: { originalInvoice: { include: { invoiceItems: true } } },
          orderBy: { createdAt: 'desc' },
        });

        const totalRefundAmount = refunds.reduce((s, r) => s + r.refundAmount, 0);

        return NextResponse.json({
          totalRefunds: refunds.length,
          totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
          refunds: refunds.map((r) => ({
            id: r.id,
            refundNumber: r.refundNumber,
            date: r.date,
            originalInvoiceNumber: r.originalInvoice?.invoiceNumber || '',
            customerName: r.originalInvoice?.customerName || '',
            refundAmount: r.refundAmount,
            reason: r.reason,
            status: r.status,
            items: JSON.parse(r.items || '[]'),
          })),
        });
      }

      case 'returns': {
        const returnedInvoices = await db.invoice.findMany({
          where: { ...invoiceWhere, status: { in: ['Refunded', 'Cancelled'] } },
          include: { invoiceItems: true, refunds: true },
          orderBy: { date: 'desc' },
        });

        const totalReturnedAmount = returnedInvoices.reduce((s, i) => s + i.grandTotal, 0);

        return NextResponse.json({
          totalReturns: returnedInvoices.length,
          totalReturnedAmount: Math.round(totalReturnedAmount * 100) / 100,
          returns: returnedInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            customerName: inv.customerName,
            grandTotal: inv.grandTotal,
            status: inv.status,
            paymentMethod: inv.paymentMethod,
            refundCount: inv.refunds.length,
            totalRefunded: inv.refunds.reduce((s, r) => s + r.refundAmount, 0),
            items: inv.invoiceItems.map((ii) => ({
              name: ii.name,
              qty: ii.qty,
              rate: ii.rate,
              total: ii.total,
            })),
          })),
        });
      }

      case 'replace': {
        const replacedInvoices = await db.invoice.findMany({
          where: { ...invoiceWhere, status: 'Replaced' },
          include: { invoiceItems: true },
          orderBy: { date: 'desc' },
        });

        const totalReplacedAmount = replacedInvoices.reduce((s, i) => s + i.grandTotal, 0);

        return NextResponse.json({
          totalReplaced: replacedInvoices.length,
          totalReplacedAmount: Math.round(totalReplacedAmount * 100) / 100,
          replacements: replacedInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            customerName: inv.customerName,
            grandTotal: inv.grandTotal,
            paidAmount: inv.paidAmount || 0,
            paymentMethod: inv.paymentMethod,
            orderType: inv.orderType,
            items: inv.invoiceItems.map((ii) => ({
              name: ii.name,
              qty: ii.qty,
              rate: ii.rate,
              total: ii.total,
            })),
          })),
        });
      }

      case 'items': {
        const invoices = await db.invoice.findMany({
          where: { ...invoiceWhere, status: { notIn: ['Refunded', 'Cancelled'] } },
          include: { invoiceItems: true },
        });

        // Aggregate item sales
        const itemMap: Record<string, { name: string; totalQty: number; totalRevenue: number; count: number }> = {};
        invoices.forEach((inv) => {
          inv.invoiceItems.forEach((ii) => {
            if (!itemMap[ii.name]) {
              itemMap[ii.name] = { name: ii.name, totalQty: 0, totalRevenue: 0, count: 0 };
            }
            itemMap[ii.name].totalQty += ii.qty;
            itemMap[ii.name].totalRevenue += ii.total;
            itemMap[ii.name].count++;
          });
        });

        const itemSales = Object.values(itemMap)
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .map((item) => ({
            ...item,
            totalRevenue: Math.round(item.totalRevenue * 100) / 100,
          }));

        const totalItemRevenue = itemSales.reduce((s, i) => s + i.totalRevenue, 0);
        const totalItemQty = itemSales.reduce((s, i) => s + i.totalQty, 0);

        return NextResponse.json({
          totalItems: itemSales.length,
          totalItemRevenue: Math.round(totalItemRevenue * 100) / 100,
          totalItemQty,
          items: itemSales,
        });
      }

      case 'inventory': {
        const items = await db.item.findMany({
          where: { unitCode: session.unitCode },
          orderBy: { quantity: 'asc' },
        });

        const totalItems = items.length;
        const totalValue = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const lowStock = items.filter((i) => i.quantity <= 5);
        const outOfStock = items.filter((i) => i.quantity <= 0);
        const wellStocked = items.filter((i) => i.quantity > 5);

        // Category breakdown
        const catMap: Record<string, { count: number; value: number; qty: number }> = {};
        items.forEach((item) => {
          const cat = item.category || 'Uncategorized';
          if (!catMap[cat]) catMap[cat] = { count: 0, value: 0, qty: 0 };
          catMap[cat].count++;
          catMap[cat].value += item.price * item.quantity;
          catMap[cat].qty += item.quantity;
        });

        return NextResponse.json({
          totalItems,
          totalValue: Math.round(totalValue * 100) / 100,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
          wellStockedCount: wellStocked.length,
          categoryBreakdown: Object.entries(catMap).map(([category, data]) => ({
            category,
            count: data.count,
            value: Math.round(data.value * 100) / 100,
            qty: data.qty,
          })),
          lowStockItems: lowStock.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            price: i.price,
            quantity: i.quantity,
          })),
        });
      }

      case 'cashflow': {
        const [invoices, pettyCashTxns] = await Promise.all([
          db.invoice.findMany({ where: invoiceWhere }),
          db.pettyCashTransaction.findMany({ where: pettyCashWhere, orderBy: { date: 'asc' } }),
        ]);

        const invoiceIncome = invoices
          .filter((i) => !['refunded', 'cancelled'].includes((i.status || '').toLowerCase()))
          .reduce((s, i) => s + (i.paidAmount || 0), 0);

        const pettyIncome = pettyCashTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const pettyExpense = pettyCashTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        // Daily cash flow
        const dailyMap: Record<string, { income: number; expense: number }> = {};
        pettyCashTxns.forEach((txn) => {
          if (!dailyMap[txn.date]) dailyMap[txn.date] = { income: 0, expense: 0 };
          if (txn.type === 'income') dailyMap[txn.date].income += txn.amount;
          else dailyMap[txn.date].expense += txn.amount;
        });

        const dailyCashFlow = Object.entries(dailyMap)
          .map(([date, data]) => ({
            date,
            income: Math.round(data.income * 100) / 100,
            expense: Math.round(data.expense * 100) / 100,
            net: Math.round((data.income - data.expense) * 100) / 100,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
          totalInvoiceIncome: Math.round(invoiceIncome * 100) / 100,
          totalPettyIncome: Math.round(pettyIncome * 100) / 100,
          totalPettyExpense: Math.round(pettyExpense * 100) / 100,
          netCashFlow: Math.round((invoiceIncome + pettyIncome - pettyExpense) * 100) / 100,
          dailyCashFlow,
          transactions: pettyCashTxns.map((t) => ({
            id: t.id,
            date: t.date,
            type: t.type,
            amount: t.amount,
            description: t.description,
          })),
        });
      }

      case 'status': {
        const invoices = await db.invoice.findMany({ where: invoiceWhere });

        const statusMap: Record<string, { count: number; totalAmount: number; totalPaid: number; totalBalance: number }> = {};
        invoices.forEach((inv) => {
          const status = inv.status || 'Pending';
          if (!statusMap[status]) statusMap[status] = { count: 0, totalAmount: 0, totalPaid: 0, totalBalance: 0 };
          statusMap[status].count++;
          statusMap[status].totalAmount += inv.grandTotal;
          statusMap[status].totalPaid += inv.paidAmount || 0;
          statusMap[status].totalBalance += inv.balanceAmount || 0;
        });

        const statusSummary = Object.entries(statusMap).map(([status, data]) => ({
          status,
          count: data.count,
          totalAmount: Math.round(data.totalAmount * 100) / 100,
          totalPaid: Math.round(data.totalPaid * 100) / 100,
          totalBalance: Math.round(data.totalBalance * 100) / 100,
        }));

        return NextResponse.json({
          totalInvoices: invoices.length,
          totalAmount: Math.round(invoices.reduce((s, i) => s + i.grandTotal, 0) * 100) / 100,
          statusSummary,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Advanced report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
