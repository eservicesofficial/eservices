import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/tables/[id]/settle — Settle a table's bill
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'billing', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;

    // Verify table belongs to this unit
    const table = await db.restaurantTable.findUnique({ where: { id } });
    if (!table || table.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Find active session
    const activeSession = await db.tableSession.findFirst({
      where: { tableId: id, status: 'active' },
      include: {
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!activeSession) {
      return NextResponse.json({ error: 'No active session for this table' }, { status: 409 });
    }

    const body = await request.json();
    const paymentMethod = String(body.paymentMethod || 'Cash').trim();
    const discountAmount = parseFloat(String(body.discountAmount)) || 0;
    const paidAmount = parseFloat(String(body.paidAmount)) || 0;
    const enableGst = body.enableGst === true;
    const gstRate = parseFloat(String(body.gstRate)) || 0;

    // Calculate totals from all orders (only non-cancelled items)
    let subtotal = 0;
    const allInvoiceItems: { itemId: string; name: string; description: string; qty: number; rate: number; total: number }[] = [];

    for (const order of activeSession.orders) {
      for (const item of order.items) {
        if (item.status === 'cancelled') continue;
        subtotal += item.total;
        allInvoiceItems.push({
          itemId: item.itemId || '',
          name: item.name,
          description: `Order #${order.orderNumber}`,
          qty: item.qty,
          rate: item.rate,
          total: item.total,
        });
      }
    }

    if (allInvoiceItems.length === 0) {
      return NextResponse.json({ error: 'No billable items in this session' }, { status: 400 });
    }

    // Calculate tax
    const taxableAmount = subtotal - discountAmount;
    const totalGst = enableGst ? (taxableAmount * gstRate) / 100 : 0;
    const cgst = enableGst ? totalGst / 2 : 0;
    const sgst = enableGst ? totalGst / 2 : 0;
    const grandTotal = taxableAmount + totalGst;
    const balanceAmount = grandTotal - paidAmount;

    // Get settings for invoice number generation
    const settings = await db.settings.findUnique({
      where: { unitCode: session.unitCode },
    });

    // Generate invoice number
    const prefix = settings?.billPrefix || '';
    const nextNumber = (settings?.billCurrentNumber || 0) + 1;
    const invoiceNumber = prefix ? `${prefix}-${String(nextNumber).padStart(4, '0')}` : String(nextNumber).padStart(4, '0');

    // Process settlement in a transaction
    const result = await db.$transaction(async (tx) => {
      // Check for duplicate invoice number
      const existingInvoice = await tx.invoice.findFirst({
        where: { invoiceNumber, unitCode: session.unitCode },
      });
      if (existingInvoice) {
        throw new Error(`Invoice number "${invoiceNumber}" already exists`);
      }

      // Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          unitCode: session.unitCode,
          invoiceNumber,
          date: new Date().toISOString().split('T')[0],
          customerName: activeSession.customerName || 'Table ' + table.tableNumber,
          customerAddress: '',
          customerPhone: activeSession.customerPhone || '',
          paymentMethod,
          status: balanceAmount <= 0 ? 'Paid' : 'Balance',
          subtotal,
          cgst,
          sgst,
          deliveryCharge: 0,
          discountAmount,
          grandTotal,
          paidAmount,
          balanceAmount,
          orderType: 'Dine-In',
          invoiceItems: {
            create: allInvoiceItems,
          },
        },
        include: { invoiceItems: true },
      });

      // Deduct stock for each item that has an itemId
      const stockUpdates: { name: string; deducted: number; remaining: number }[] = [];
      for (const item of allInvoiceItems) {
        if (item.itemId && item.qty > 0) {
          const inventoryItem = await tx.item.findFirst({
            where: { id: item.itemId, unitCode: session.unitCode },
          });
          if (inventoryItem) {
            const newQty = Math.max(0, inventoryItem.quantity - item.qty);
            await tx.item.update({
              where: { id: item.itemId },
              data: { quantity: newQty },
            });
            stockUpdates.push({ name: inventoryItem.name, deducted: item.qty, remaining: newQty });
          }
        }
      }

      // Update the session
      await tx.tableSession.update({
        where: { id: activeSession.id },
        data: {
          status: 'settled',
          closedAt: new Date(),
          totalAmount: grandTotal,
          paidAmount,
          discountAmount,
          taxAmount: totalGst,
          paymentMethod,
          invoiceId: invoice.id,
          invoiceNumber,
        },
      });

      // Mark table as available
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'available' },
      });

      // Increment bill current number in settings
      await tx.settings.update({
        where: { unitCode: session.unitCode },
        data: { billCurrentNumber: nextNumber },
      });

      return { invoice, stockUpdates };
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'SETTLE_TABLE_BILL',
      `Table ${table.tableNumber} - Invoice ${invoiceNumber}`,
      {
        sessionId: activeSession.id,
        invoiceId: result.invoice.id,
        invoiceNumber,
        subtotal,
        discountAmount,
        taxAmount: cgst + sgst,
        grandTotal,
        paidAmount,
        balanceAmount,
        paymentMethod,
        stockUpdates: result.stockUpdates,
      },
      request
    );

    return NextResponse.json({ ...result.invoice, stockUpdates: result.stockUpdates }, { status: 201 });
  } catch (error) {
    console.error('Error settling table bill:', error);
    const msg = error instanceof Error ? error.message : 'Failed to settle table bill';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
