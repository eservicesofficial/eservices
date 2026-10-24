import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/tables — List all restaurant tables
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { unitCode: session.unitCode };
    if (section) where.section = section;
    if (status) where.status = status;

    const tables = await db.restaurantTable.findMany({
      where,
      orderBy: [{ section: 'asc' }, { tableNumber: 'asc' }],
    });

    return NextResponse.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}

// POST /api/tables — Create a new table
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!sessionHasPermission(session, 'inventory', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const tableNumber = Number(body.tableNumber) || 0;
    if (tableNumber <= 0) {
      return NextResponse.json({ error: 'Table number must be positive' }, { status: 400 });
    }

    // Check for duplicate table number
    const existing = await db.restaurantTable.findUnique({
      where: { unitCode_tableNumber: { unitCode: session.unitCode, tableNumber } },
    });
    if (existing) {
      return NextResponse.json({ error: `Table ${tableNumber} already exists` }, { status: 409 });
    }

    const table = await db.restaurantTable.create({
      data: {
        unitCode: session.unitCode,
        tableNumber,
        name: String(body.name || '').trim(),
        capacity: Number(body.capacity) || 4,
        section: String(body.section || '').trim(),
        status: String(body.status || 'available'),
      },
    });

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_TABLE', `Table ${tableNumber}`, { tableId: table.id }, request);

    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    console.error('Error creating table:', error);
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
  }
}
