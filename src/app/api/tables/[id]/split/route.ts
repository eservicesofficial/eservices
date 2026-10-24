import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/tables/[id]/split — Split bill for a table
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'billing', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;

    // Verify source table belongs to this unit
    const sourceTable = await db.restaurantTable.findUnique({ where: { id } });
    if (!sourceTable || sourceTable.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    // Find active session on source table
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
    const itemIds: string[] = body.itemIds;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'itemIds must be a non-empty array of order item IDs' }, { status: 400 });
    }

    // Find available table for the split session
    // Try to find one automatically, or the client can provide a targetTableId
    const targetTableId = body.targetTableId ? String(body.targetTableId).trim() : '';

    let splitTargetTable;
    if (targetTableId) {
      splitTargetTable = await db.restaurantTable.findUnique({ where: { id: targetTableId } });
      if (!splitTargetTable || splitTargetTable.unitCode !== session.unitCode) {
        return NextResponse.json({ error: 'Target table not found' }, { status: 404 });
      }
      if (splitTargetTable.status === 'occupied') {
        return NextResponse.json({ error: 'Target table is already occupied' }, { status: 409 });
      }
    } else {
      // Find the first available table (excluding current table)
      splitTargetTable = await db.restaurantTable.findFirst({
        where: {
          unitCode: session.unitCode,
          status: 'available',
          id: { not: id },
        },
        orderBy: { tableNumber: 'asc' },
      });
      if (!splitTargetTable) {
        return NextResponse.json({ error: 'No available table found for the split. All tables are occupied.' }, { status: 409 });
      }
    }

    // Group selected items by their parent order
    const selectedItemsMap = new Set(itemIds);

    // Collect items to split per order
    const ordersWithSplitItems: { orderId: string; itemsToSplit: typeof activeSession.orders[0]['items'] }[] = [];
    for (const order of activeSession.orders) {
      const itemsToSplit = order.items.filter((item) => selectedItemsMap.has(item.id));
      if (itemsToSplit.length > 0) {
        ordersWithSplitItems.push({ orderId: order.id, itemsToSplit });
      }
    }

    if (ordersWithSplitItems.length === 0) {
      return NextResponse.json({ error: 'No matching items found for the given itemIds' }, { status: 400 });
    }

    // Check if all items would be moved (entire session transferred — suggest transfer instead)
    const totalActiveItems = activeSession.orders.reduce(
      (sum, order) => sum + order.items.filter((i) => i.status !== 'cancelled').length,
      0
    );
    if (selectedItemsMap.size >= totalActiveItems) {
      return NextResponse.json(
        { error: 'All items selected. Use table transfer instead of split.' },
        { status: 400 }
      );
    }

    // Perform split in transaction
    const result = await db.$transaction(async (tx) => {
      // Create a new session on the target table
      const newSession = await tx.tableSession.create({
        data: {
          unitCode: session.unitCode,
          tableId: splitTargetTable!.id,
          tableNumber: splitTargetTable!.tableNumber,
          guestCount: 1,
          waiterId: activeSession.waiterId,
          waiterName: activeSession.waiterName,
          customerName: activeSession.customerName,
          customerPhone: activeSession.customerPhone,
          status: 'active',
        },
      });

      // Create new orders on the new session for the split items
      for (const { itemsToSplit } of ordersWithSplitItems) {
        const newOrderSubtotal = itemsToSplit.reduce((sum, item) => sum + item.total, 0);

        await tx.tableOrder.create({
          data: {
            unitCode: session.unitCode,
            sessionId: newSession.id,
            orderNumber: 1, // Will be the first order on the new session
            subtotal: newOrderSubtotal,
            items: {
              create: itemsToSplit.map((item) => ({
                unitCode: session.unitCode,
                itemId: item.itemId || '',
                name: item.name,
                qty: item.qty,
                rate: item.rate,
                total: item.total,
                customNote: item.customNote,
                status: item.status,
              })),
            },
          },
        });
      }

      // Remove split items from original orders
      for (const item of selectedItemsMap) {
        await tx.tableOrderItem.delete({
          where: { id: item },
        });
      }

      // Recalculate subtotals for original orders that had items removed
      for (const { orderId } of ordersWithSplitItems) {
        const remainingItems = await tx.tableOrderItem.findMany({
          where: { orderId },
        });
        const newSubtotal = remainingItems.reduce((sum: number, item: { total: number }) => sum + item.total, 0);
        await tx.tableOrder.update({
          where: { id: orderId },
          data: { subtotal: newSubtotal },
        });

        // If an order has no remaining items, delete it
        if (remainingItems.length === 0) {
          await tx.tableOrder.delete({ where: { id: orderId } });
        }
      }

      // Mark target table as occupied
      await tx.restaurantTable.update({
        where: { id: splitTargetTable!.id },
        data: { status: 'occupied' },
      });

      // Return both sessions
      const updatedOriginal = await tx.tableSession.findUnique({
        where: { id: activeSession.id },
        include: {
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        },
      });

      const createdSplit = await tx.tableSession.findUnique({
        where: { id: newSession.id },
        include: {
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        },
      });

      return { originalSession: updatedOriginal, newSession: createdSplit };
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'SPLIT_TABLE_BILL',
      `Table ${sourceTable.tableNumber} → Table ${splitTargetTable.tableNumber}`,
      {
        sourceSessionId: activeSession.id,
        newSessionId: result.newSession!.id,
        sourceTableId: id,
        targetTableId: splitTargetTable.id,
        itemsSplit: itemIds.length,
      },
      request
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error splitting table bill:', error);
    return NextResponse.json({ error: 'Failed to split table bill' }, { status: 500 });
  }
}
