import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/units - list active units (public, used on login page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code') || '';

    if (code) {
      // Look up a specific unit by code
      const unit = await db.unit.findUnique({
        where: { code: code.toUpperCase().trim() },
        select: {
          code: true,
          name: true,
          description: true,
          isActive: true,
        },
      });

      if (!unit) {
        return NextResponse.json({ found: false }, { status: 404 });
      }

      return NextResponse.json({ found: true, unit });
    }

    // List all active units
    const units = await db.unit.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        description: true,
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({ units });
  } catch (error) {
    console.error('Units error:', error);
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 });
  }
}
