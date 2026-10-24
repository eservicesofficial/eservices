import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/tables/[id]/session — Get the current active session for a table
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

    const activeSession = await db.tableSession.findFirst({
      where: {
        tableId: id,
        status: 'active',
      },
      include: {
        orders: {
          include: { items: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(activeSession || null);
  } catch (error) {
    console.error('Error fetching table session:', error);
    return NextResponse.json({ error: 'Failed to fetch table session' }, { status: 500 });
  }
}

// POST /api/tables/[id]/session — Start a new session for a table
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

    // Check table is available
    if (table.status === 'occupied') {
      return NextResponse.json({ error: 'Table is already occupied' }, { status: 409 });
    }

    // Check no active session exists
    const existingSession = await db.tableSession.findFirst({
      where: { tableId: id, status: 'active' },
    });
    if (existingSession) {
      return NextResponse.json({ error: 'An active session already exists for this table' }, { status: 409 });
    }

    const body = await request.json();
    const guestCount = Number(body.guestCount) || 1;
    const waiterName = String(body.waiterName || '').trim();
    const waiterId = String(body.waiterId || '').trim();
    const customerName = String(body.customerName || '').trim();
    const customerPhone = String(body.customerPhone || '').trim();

    const tableSession = await db.$transaction(async (tx) => {
      // Create the session
      const newSession = await tx.tableSession.create({
        data: {
          unitCode: session.unitCode,
          tableId: id,
          tableNumber: table.tableNumber,
          guestCount,
          waiterId,
          waiterName,
          customerName,
          customerPhone,
          status: 'active',
        },
        include: {
          orders: { include: { items: true } },
        },
      });

      // Mark table as occupied
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'occupied' },
      });

      return newSession;
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'START_TABLE_SESSION',
      `Table ${table.tableNumber}`,
      { sessionId: tableSession.id, guestCount, waiterName, customerName },
      request
    );

    return NextResponse.json(tableSession, { status: 201 });
  } catch (error) {
    console.error('Error starting table session:', error);
    return NextResponse.json({ error: 'Failed to start table session' }, { status: 500 });
  }
}

// PATCH /api/tables/[id]/session — Update session info
export async function PATCH(
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
      return NextResponse.json({ error: 'No active session found for this table' }, { status: 404 });
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.guestCount !== undefined) updateData.guestCount = Number(body.guestCount) || 1;
    if (body.waiterName !== undefined) updateData.waiterName = String(body.waiterName).trim();
    if (body.waiterId !== undefined) updateData.waiterId = String(body.waiterId).trim();
    if (body.waiterNotes !== undefined) updateData.waiterNotes = String(body.waiterNotes).trim();
    if (body.customerName !== undefined) updateData.customerName = String(body.customerName).trim();
    if (body.customerPhone !== undefined) updateData.customerPhone = String(body.customerPhone).trim();

    const updated = await db.tableSession.update({
      where: { id: activeSession.id },
      data: updateData,
      include: {
        orders: { include: { items: true } },
      },
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'UPDATE_TABLE_SESSION',
      `Table ${table.tableNumber}`,
      { sessionId: updated.id, changes: updateData },
      request
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating table session:', error);
    return NextResponse.json({ error: 'Failed to update table session' }, { status: 500 });
  }
}

// DELETE /api/tables/[id]/session — Cancel/Close session without settling
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'billing', 'delete')) {
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
        orders: { include: { items: true } },
      },
    });
    if (!activeSession) {
      return NextResponse.json({ error: 'No active session found for this table' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Close the session
      await tx.tableSession.update({
        where: { id: activeSession.id },
        data: {
          status: 'cancelled',
          closedAt: new Date(),
        },
      });

      // Mark table as available
      await tx.restaurantTable.update({
        where: { id },
        data: { status: 'available' },
      });
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'CANCEL_TABLE_SESSION',
      `Table ${table.tableNumber}`,
      { sessionId: activeSession.id, orderCount: activeSession.orders.length },
      request
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling table session:', error);
    return NextResponse.json({ error: 'Failed to cancel table session' }, { status: 500 });
  }
}
