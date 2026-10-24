import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/tables/[id] — Get single table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const table = await db.restaurantTable.findUnique({ where: { id } });
    if (!table || table.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    return NextResponse.json(table);
  } catch (error) {
    console.error('Error fetching table:', error);
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 });
  }
}

// PUT /api/tables/[id] — Update table
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'inventory', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.restaurantTable.findUnique({ where: { id } });
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    const body = await request.json();
    const newTableNumber = body.tableNumber !== undefined ? Number(body.tableNumber) : existing.tableNumber;

    // If table number changed, check for conflicts
    if (newTableNumber !== existing.tableNumber) {
      const conflict = await db.restaurantTable.findUnique({
        where: { unitCode_tableNumber: { unitCode: session.unitCode, tableNumber: newTableNumber } },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: `Table ${newTableNumber} already exists` }, { status: 409 });
      }
    }

    const updated = await db.restaurantTable.update({
      where: { id },
      data: {
        tableNumber: newTableNumber,
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        capacity: body.capacity !== undefined ? Number(body.capacity) : existing.capacity,
        section: body.section !== undefined ? String(body.section).trim() : existing.section,
        status: body.status !== undefined ? String(body.status) : existing.status,
      },
    });

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_TABLE', `Table ${updated.tableNumber}`, { tableId: id }, request);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating table:', error);
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
  }
}

// DELETE /api/tables/[id] — Delete table
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'inventory', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.restaurantTable.findUnique({ where: { id } });
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    await db.restaurantTable.delete({ where: { id } });

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_TABLE', `Table ${existing.tableNumber}`, { tableId: id }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting table:', error);
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
  }
}
