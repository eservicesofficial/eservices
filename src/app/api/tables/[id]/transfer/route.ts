import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/tables/[id]/transfer — Transfer table session to another table
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
      return NextResponse.json({ error: 'Source table not found' }, { status: 404 });
    }

    // Find active session on source table
    const activeSession = await db.tableSession.findFirst({
      where: { tableId: id, status: 'active' },
      include: { orders: true },
    });
    if (!activeSession) {
      return NextResponse.json({ error: 'No active session on this table' }, { status: 409 });
    }

    const body = await request.json();
    const targetTableId = String(body.targetTableId || '').trim();
    if (!targetTableId) {
      return NextResponse.json({ error: 'targetTableId is required' }, { status: 400 });
    }
    if (targetTableId === id) {
      return NextResponse.json({ error: 'Cannot transfer to the same table' }, { status: 400 });
    }

    // Verify target table belongs to this unit
    const targetTable = await db.restaurantTable.findUnique({ where: { id: targetTableId } });
    if (!targetTable || targetTable.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Target table not found' }, { status: 404 });
    }

    // Check target table is available
    if (targetTable.status === 'occupied') {
      return NextResponse.json({ error: 'Target table is already occupied' }, { status: 409 });
    }

    // Check no active session on target table
    const existingTargetSession = await db.tableSession.findFirst({
      where: { tableId: targetTableId, status: 'active' },
    });
    if (existingTargetSession) {
      return NextResponse.json({ error: 'Target table already has an active session' }, { status: 409 });
    }

    // Transfer session
    const updatedSession = await db.$transaction(async (tx) => {
      // Move session to target table
      const transferred = await tx.tableSession.update({
        where: { id: activeSession.id },
        data: {
          tableId: targetTableId,
          tableNumber: targetTable.tableNumber,
        },
        include: { orders: true },
      });

      // Mark source table as available
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'available' },
      });

      // Mark target table as occupied
      await tx.restaurantTable.update({
        where: { id: targetTableId },
        data: { status: 'occupied' },
      });

      return transferred;
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'TRANSFER_TABLE',
      `Table ${sourceTable.tableNumber} → Table ${targetTable.tableNumber}`,
      {
        sessionId: activeSession.id,
        sourceTableId: id,
        targetTableId,
        orderCount: activeSession.orders.length,
      },
      request
    );

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error transferring table:', error);
    return NextResponse.json({ error: 'Failed to transfer table' }, { status: 500 });
  }
}
