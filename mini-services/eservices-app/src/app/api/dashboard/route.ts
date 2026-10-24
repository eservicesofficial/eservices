import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// Helper: format a Date object as YYYY-MM-DD string in IST
function toISTDateString(date: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStr = toISTDateString(now);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);

    // Get all invoices for this unit (single query) and compute everything in memory
    const allInvoices = await db.invoice.findMany({
      where: { unitCode: session.unitCode },
      orderBy: { date: 'desc' },
    });

    // Helper: check if invoice is active (not refunded, cancelled, or replaced)
    const isActive = (inv: { status?: string | null }) => {
      const s = (inv.status || '').toLowerCase();
      return s !== 'refunded' && s !== 'cancelled' && s !== 'replaced';
    };

    // Revenue calculation:
    // - Active invoices (Paid, Pending, Balance): use grandTotal
    // - Replaced invoices: use paidAmount (customer already paid this amount)
    // - Refunded/Cancelled: excluded entirely
    const activeInvoices = allInvoices.filter(isActive);
    const replacedInvoices = allInvoices.filter(inv => (inv.status || '').toLowerCase() === 'replaced');

    // Today's summary
    const todayInvoices = allInvoices.filter(inv => inv.date === todayStr && isActive(inv));
    const todayReplaced = allInvoices.filter(inv => inv.date === todayStr && (inv.status || '').toLowerCase() === 'replaced');
    const todayRevenue = todayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0) + todayReplaced.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const todayInvoiceCount = todayInvoices.length + todayReplaced.length;
    const todayCompletedCount = todayInvoices.filter((inv) => inv.isCompleted).length;
    const todayPendingCount = todayInvoices.filter((inv) => !inv.isCompleted).length;

    // Last 7 days revenue trend — active invoices + replaced invoices (paidAmount only)
    const trendData: { date: string; label: string; revenue: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(istDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = toISTDateString(d);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const dayActive = activeInvoices.filter(inv => inv.date === dateStr);
      const dayReplaced = replacedInvoices.filter(inv => inv.date === dateStr);
      const revenue = dayActive.reduce((sum, inv) => sum + inv.grandTotal, 0) + dayReplaced.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
      const count = dayActive.length + dayReplaced.length;
      trendData.push({ date: dateStr, label, revenue, count });
    }

    // Overall stats — active invoices + replaced invoices (paidAmount only)
    const totalInvoices = activeInvoices.length + replacedInvoices.length;
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0) + replacedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const pendingBills = activeInvoices.filter(inv => inv.status === 'Pending' && !inv.isCompleted).length;

    // Refunded/replaced/cancelled counts for awareness
    const refundedCount = allInvoices.filter(inv => (inv.status || '').toLowerCase() === 'refunded').length;
    const replacedCount = allInvoices.filter(inv => (inv.status || '').toLowerCase() === 'replaced').length;
    const cancelledCount = allInvoices.filter(inv => (inv.status || '').toLowerCase() === 'cancelled').length;

    // Recent invoices — include all statuses for history visibility
    const recentInvoices = allInvoices.slice(0, 10);

    return NextResponse.json({
      today: {
        date: todayStr,
        revenue: todayRevenue,
        invoiceCount: todayInvoiceCount,
        completedCount: todayCompletedCount,
        pendingCount: todayPendingCount,
      },
      trend: trendData,
      overall: {
        totalInvoices,
        totalRevenue,
        pendingBills,
        refundedCount,
        replacedCount,
        cancelledCount,
      },
      recentInvoices,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
