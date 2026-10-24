import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, hashPassword, logAction, ROLE_PERMISSIONS } from '@/lib/auth';

// GET /api/super-admin/businesses/[code]/users — List users in a business
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unitCode = code.toUpperCase();

    const unit = await db.unit.findUnique({ where: { code: unitCode } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const users = await db.user.findMany({
      where: { unitCode },
      select: {
        id: true, loginId: true, name: true, role: true,
        permissions: true, isActive: true, mustChangePassword: true,
        lastLogin: true, createdAt: true, updatedAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    const mapped = users.map(u => {
      let parsedPerms = {};
      try { parsedPerms = JSON.parse(u.permissions || '{}'); } catch { parsedPerms = {}; }
      return {
        ...u,
        permissions: parsedPerms,
        status: u.isActive ? 'Active' : 'Suspended',
      };
    });

    return NextResponse.json({ users: mapped });
  } catch (error) {
    console.error('List business users error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/super-admin/businesses/[code]/users — Create user in a business
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unitCode = code.toUpperCase();
    const body = await request.json();
    const { loginId, name, password, role, permissions } = body;

    if (!loginId || !name || !password || !role) {
      return NextResponse.json({ error: 'Login ID, Name, Password, and Role are required' }, { status: 400 });
    }

    const unit = await db.unit.findUnique({ where: { code: unitCode } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const validRoles = ['Admin', 'Manager', 'Cashier', 'Staff'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    // Check duplicate
    const existing = await db.user.findUnique({
      where: { unitCode_loginId: { unitCode, loginId: loginId.trim().toLowerCase() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this Login ID already exists' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const finalPermissions = permissions
      ? JSON.stringify(permissions)
      : JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Staff']);

    const user = await db.user.create({
      data: {
        unitCode,
        loginId: loginId.trim().toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role,
        permissions: finalPermissions,
        mustChangePassword: true,
      },
    });

    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'CREATE_USER', user.name, { unitCode, loginId: user.loginId, role }, request);

    return NextResponse.json({
      success: true,
      user: { id: user.id, loginId: user.loginId, name: user.name, role: user.role, mustChangePassword: user.mustChangePassword },
    });
  } catch (error) {
    console.error('Create business user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
