import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/tables/merge — Merge two tables (move orders from source to target)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'billing', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const sourceTableId = String(body.sourceTableId || '').trim();
    const targetTableId = String(body.targetTableId || '').trim();

    if (!sourceTableId || !targetTableId) {
      return NextResponse.json({ error: 'sourceTableId and targetTableId are required' }, { status: 400 });
    }
    if (sourceTableId === targetTableId) {
      return NextResponse.json({ error: 'Cannot merge a table with itself' }, { status: 400 });
    }

    // Verify both tables belong to this unit
    const sourceTable = await db.restaurantTable.findUnique({ where: { id: sourceTableId } });
    const targetTable = await db.restaurantTable.findUnique({ where: { id: targetTableId } });

    if (!sourceTable || sourceTable.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Source table not found' }, { status: 404 });
    }
    if (!targetTable || targetTable.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Target table not found' }, { status: 404 });
    }

    // Find active sessions
    const sourceSession = await db.tableSession.findFirst({
      where: { tableId: sourceTableId, status: 'active' },
      include: {
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!sourceSession) {
      return NextResponse.json({ error: 'No active session on source table' }, { status: 409 });
    }

    const targetSession = await db.tableSession.findFirst({
      where: { tableId: targetTableId, status: 'active' },
    });
    if (!targetSession) {
      return NextResponse.json({ error: 'No active session on target table. Start a session first.' }, { status: 409 });
    }

    // Merge orders from source to target
    const result = await db.$transaction(async (tx) => {
      // Get current max order number on target session
      const maxOrderResult = await tx.tableOrder.aggregate({
        where: { sessionId: targetSession.id },
        _max: { orderNumber: true },
      });
      let nextOrderNumber = (maxOrderResult._max.orderNumber || 0) + 1;

      // Move each order from source to target
      for (const order of sourceSession.orders) {
        await tx.tableOrder.update({
          where: { id: order.id },
          data: {
            sessionId: targetSession.id,
            orderNumber: nextOrderNumber++,
          },
        });
      }

      // Close source session
      await tx.tableSession.update({
        where: { id: sourceSession.id },
        data: {
          status: 'merged',
          closedAt: new Date(),
        },
      });

      // Mark source table as available
      await tx.restaurantTable.update({
        where: { id: sourceTableId },
        data: { status: 'available' },
      });

      // Return updated target session
      return tx.tableSession.findUnique({
        where: { id: targetSession.id },
        include: {
          orders: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        },
      });
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'MERGE_TABLES',
      `Table ${sourceTable.tableNumber} → Table ${targetTable.tableNumber}`,
      {
        sourceSessionId: sourceSession.id,
        targetSessionId: targetSession.id,
        sourceTableId,
        targetTableId,
        ordersMerged: sourceSession.orders.length,
      },
      request
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error merging tables:', error);
    return NextResponse.json({ error: 'Failed to merge tables' }, { status: 500 });
  }
}
