import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PUT /api/tables/[id]/orders/[orderId] — Update order items or order status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, orderId } = await params;

    // Verify table belongs to this unit
    const table = await db.restaurantTable.findUnique({ where: { id } });
    if (!table || table.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Find active session for this table
    const activeSession = await db.tableSession.findFirst({
      where: { tableId: id, status: 'active' },
    });
    if (!activeSession) {
      return NextResponse.json({ error: 'No active session for this table' }, { status: 404 });
    }

    // Find the order within the active session
    const existingOrder = await db.tableOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existingOrder || existingOrder.sessionId !== activeSession.id) {
      return NextResponse.json({ error: 'Order not found in this session' }, { status: 404 });
    }

    const body = await request.json();

    // Case 1: Update order-level status
    if (body.status && !body.items) {
      const validStatuses = ['new', 'preparing', 'ready', 'served', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: `Invalid order status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
      }

      const updated = await db.tableOrder.update({
        where: { id: orderId },
        data: { status: String(body.status) },
        include: { items: true },
      });

      await logAction(
        session.unitCode,
        session.userId,
        session.name,
        session.role,
        'UPDATE_ORDER_STATUS',
        `Table ${table.tableNumber} - Order #${existingOrder.orderNumber}`,
        { orderId, status: body.status },
        request
      );

      return NextResponse.json(updated);
    }

    // Case 2: Update individual items (qty, status)
    if (body.items && Array.isArray(body.items)) {
      const updatedSubtotal = await db.$transaction(async (tx) => {
        for (const itemUpdate of body.items) {
          if (!itemUpdate.id) continue;

          const updateData: Record<string, unknown> = {};
          if (itemUpdate.qty !== undefined) {
            updateData.qty = parseInt(String(itemUpdate.qty)) || 1;
          }
          if (itemUpdate.status !== undefined) {
            const validItemStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
            if (!validItemStatuses.includes(itemUpdate.status)) {
              throw new Error(`Invalid item status: ${itemUpdate.status}`);
            }
            updateData.status = String(itemUpdate.status);
          }

          // Also update the total if qty changed
          const existingItem = existingOrder.items.find((i) => i.id === itemUpdate.id);
          if (existingItem && itemUpdate.qty !== undefined) {
            const newQty = parseInt(String(itemUpdate.qty)) || 1;
            updateData.total = newQty * existingItem.rate;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.tableOrderItem.update({
              where: { id: itemUpdate.id },
              data: updateData,
            });
          }
        }

        // Recalculate order subtotal
        const allItems = await tx.tableOrderItem.findMany({
          where: { orderId },
        });
        const newSubtotal = allItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);

        await tx.tableOrder.update({
          where: { id: orderId },
          data: { subtotal: newSubtotal },
        });

        return newSubtotal;
      });

      const updatedOrder = await db.tableOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      await logAction(
        session.unitCode,
        session.userId,
        session.name,
        session.role,
        'UPDATE_ORDER_ITEMS',
        `Table ${table.tableNumber} - Order #${existingOrder.orderNumber}`,
        { orderId, updatedSubtotal, itemCount: body.items.length },
        request
      );

      return NextResponse.json(updatedOrder);
    }

    // Case 3: Update table notes
    if (body.tableNotes !== undefined) {
      const updated = await db.tableOrder.update({
        where: { id: orderId },
        data: { tableNotes: String(body.tableNotes).trim() },
        include: { items: true },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
  } catch (error) {
    console.error('Error updating table order:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update table order';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/tables/[id]/orders/[orderId] — Remove/cancel an order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, orderId } = await params;

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
      return NextResponse.json({ error: 'No active session for this table' }, { status: 404 });
    }

    // Find the order
    const existingOrder = await db.tableOrder.findUnique({
      where: { id: orderId },
    });
    if (!existingOrder || existingOrder.sessionId !== activeSession.id) {
      return NextResponse.json({ error: 'Order not found in this session' }, { status: 404 });
    }

    await db.tableOrder.delete({
      where: { id: orderId },
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'DELETE_TABLE_ORDER',
      `Table ${table.tableNumber} - Order #${existingOrder.orderNumber}`,
      { sessionId: activeSession.id, orderId, orderNumber: existingOrder.orderNumber },
      request
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting table order:', error);
    return NextResponse.json({ error: 'Failed to delete table order' }, { status: 500 });
  }
}
