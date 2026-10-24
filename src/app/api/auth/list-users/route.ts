import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

// GET /api/auth/list-users - List users for switch-user feature (Admin & Manager)
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin or Manager can list users for switching
    if (!isAdmin(session.role) && session.role !== 'Manager') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const users = await db.user.findMany({
      where: { unitCode: session.unitCode, isActive: true },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        isActive: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // For Manager: only show Cashier and Staff (not other Managers or Admins)
    if (!isAdmin(session.role)) {
      const filteredUsers = users.filter(u => u.role === 'Cashier' || u.role === 'Staff');
      return NextResponse.json(filteredUsers);
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error('List users for switch error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}
