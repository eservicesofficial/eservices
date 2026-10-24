import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET /api/custom-fields — Get all custom item fields for the current business
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const unitCode = session.unitCode;

    const fields = await db.customItemField.findMany({
      where: { unitCode, visible: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Parse options JSON for each field
    const parsedFields = fields.map((f) => ({
      ...f,
      options: JSON.parse(f.options || '[]'),
    }));

    return NextResponse.json({ fields: parsedFields });
  } catch (error) {
    console.error('Get custom fields error:', error);
    return NextResponse.json({ error: 'Failed to get custom fields' }, { status: 500 });
  }
}
