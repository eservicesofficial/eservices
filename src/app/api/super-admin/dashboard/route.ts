import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest } from '@/lib/auth';

// GET /api/super-admin/dashboard — Dashboard stats
export async function GET(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [totalBusinesses, activeBusinesses, inactiveBusinesses, totalUsers, recentLogs, categoryBreakdown] = await Promise.all([
      db.unit.count(),
      db.unit.count({ where: { isActive: true } }),
      db.unit.count({ where: { isActive: false } }),
      db.user.count(),
      db.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, unitCode: true, userName: true, role: true,
          action: true, target: true, details: true, ipAddress: true, createdAt: true,
        },
      }),
      db.unit.groupBy({ by: ['category'], _count: { code: true } }),
    ]);

    // Get recent businesses
    const recentBusinesses = await db.unit.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { code: true, name: true, category: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({
      stats: {
        totalBusinesses,
        activeBusinesses,
        inactiveBusinesses,
        totalUsers,
      },
      categoryBreakdown: categoryBreakdown.map(c => ({
        category: c.category || 'N/A',
        count: c._count.code,
      })),
      recentBusinesses,
      recentLogs,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to get dashboard stats' }, { status: 500 });
  }
}
