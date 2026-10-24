import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/tables/[id]/orders — Get all orders for the active session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify table belongs to this unit
    const table = await db.restaurantTable.findUnique({ where: { id } });
    if (!table || table.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Find active session
    const activeSession = await db.tableSession.findFirst({
      where: { tableId: id, status: 'active' },
    });
    if (!activeSession) {
      return NextResponse.json([]);
    }

    const orders = await db.tableOrder.findMany({
      where: { sessionId: activeSession.id },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching table orders:', error);
    return NextResponse.json({ error: 'Failed to fetch table orders' }, { status: 500 });
  }
}

// POST /api/tables/[id]/orders — Add a new order (auto-creates session if needed)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify table belongs to this unit
    const table = await db.restaurantTable.findUnique({ where: { id } });
    if (!table || table.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const body = await request.json();
    const { items, tableNotes, guestCount, waiterName, customerName, customerPhone } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item' }, { status: 400 });
    }

    // Validate items
    for (const item of items) {
      if (!item.name || item.qty <= 0) {
        return NextResponse.json({ error: 'Each item must have a name and positive qty' }, { status: 400 });
      }
    }

    // Calculate order items with safe defaults
    const orderItems = items.map((item: { itemId?: string; name: string; qty: number; rate: number; customNote?: string }) => ({
      itemId: String(item.itemId || ''),
      name: String(item.name).trim(),
      qty: Math.max(1, parseInt(String(item.qty)) || 1),
      rate: Math.max(0, parseFloat(String(item.rate)) || 0),
      total: Math.max(1, parseInt(String(item.qty)) || 1) * Math.max(0, parseFloat(String(item.rate)) || 0),
      customNote: String(item.customNote || '').trim(),
      status: 'pending',
    }));

    const subtotal = orderItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);

    const newOrder = await db.$transaction(async (tx) => {
      // Find or create active session
      let activeSession = await tx.tableSession.findFirst({
        where: { tableId: id, status: 'active' },
      });

      if (!activeSession) {
        // Auto-create a session for this table
        if (table.status !== 'available' && table.status !== 'reserved') {
          throw new Error(`Cannot start session: table status is "${table.status}"`);
        }

        activeSession = await tx.tableSession.create({
          data: {
            unitCode: session.unitCode,
            tableId: id,
            tableNumber: table.tableNumber,
            guestCount: Number(guestCount) || 1,
            waiterName: String(waiterName || session.name || '').trim(),
            waiterId: String(session.userId || '').trim(),
            customerName: String(customerName || '').trim(),
            customerPhone: String(customerPhone || '').trim(),
            status: 'active',
          },
          include: { orders: { include: { items: true } } },
        });

        // Mark table as occupied
        await tx.restaurantTable.update({
          where: { id },
          data: { status: 'occupied' },
        });
      }

      // Get current max order number for this session
      const maxOrderResult = await tx.tableOrder.aggregate({
        where: { sessionId: activeSession.id },
        _max: { orderNumber: true },
      });
      const nextOrderNumber = (maxOrderResult._max.orderNumber || 0) + 1;

      // Create the order with items
      const order = await tx.tableOrder.create({
        data: {
          unitCode: session.unitCode,
          sessionId: activeSession.id,
          orderNumber: nextOrderNumber,
          tableNotes: String(tableNotes || '').trim(),
          subtotal,
          items: {
            create: orderItems,
          },
        },
        include: { items: true },
      });

      return { order, sessionCreated: true };
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ADD_TABLE_ORDER',
      `Table ${table.tableNumber} - Order #${newOrder.order.orderNumber}`,
      { sessionId: newOrder.order.sessionId, orderId: newOrder.order.id, orderNumber: newOrder.order.orderNumber, itemCount: newOrder.order.items.length, subtotal },
      request
    );

    return NextResponse.json(newOrder.order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating table order:', error);
    const message = error?.message || 'Failed to create table order';
    if (message.includes('Cannot start session')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
