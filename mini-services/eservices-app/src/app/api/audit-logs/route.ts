import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, isAdminOrManager } from '@/lib/auth';

// GET /api/audit-logs - query audit logs (Admin or Manager only)
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin and Manager can view audit logs
    if (!isAdminOrManager(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100); // Cap at 100
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const search = (searchParams.get('search') || '').trim();

    // Build where clause efficiently
    const where: Record<string, unknown> = { unitCode: session.unitCode };

    if (action) where.action = action;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end.toISOString();
      }
      where.createdAt = dateFilter;
    }

    // Only use OR search if search term is provided and meaningful
    if (search.length >= 2) {
      where.OR = [
        { userName: { contains: search } },
        { action: { contains: search } },
        { target: { contains: search } },
      ];
    }

    // Fetch count and data in parallel with lean select
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          userName: true,
          role: true,
          action: true,
          target: true,
          details: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
