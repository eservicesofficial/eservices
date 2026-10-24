import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, isAdmin, isAdminOrManager, hashPassword, logAction, hasPermissionFromDB, ROLE_PERMISSIONS } from '@/lib/auth';

// GET /api/users - list all users in current unit (Admin or user with userManagement permission)
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission from DB (real-time, not JWT) — only Admin or users granted userManagement
    const canViewUsers = isAdmin(session.role) || await hasPermissionFromDB(session.userId, session.role, 'settings', 'userManagement');
    if (!canViewUsers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const users = await db.user.findMany({
      where: { unitCode: session.unitCode },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Map isActive to status for frontend & parse permissions
    const mappedUsers = users.map(u => {
      let parsedPerms = {};
      try {
        parsedPerms = typeof u.permissions === 'string' ? JSON.parse(u.permissions) : (u.permissions || {});
      } catch {
        parsedPerms = {};
      }
      return {
        id: u.id,
        loginId: u.loginId,
        name: u.name,
        role: u.role,
        permissions: parsedPerms,
        status: u.isActive ? 'Active' : 'Suspended',
        lastLogin: u.lastLogin,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    });

    return NextResponse.json(mappedUsers);
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/users - create a new user (Admin or Manager with userManagement permission)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage users (from DB, real-time)
    const canManageUsers = isAdmin(session.role) || await hasPermissionFromDB(session.userId, session.role, 'settings', 'userManagement');
    if (!canManageUsers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { loginId, password, name, role, permissions } = body;

    if (!loginId || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Login ID, Password, Name, and Role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['Admin', 'Manager', 'Cashier', 'Staff'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Role hierarchy: only Admin can create Admin accounts
    // Manager can create Manager, Cashier, Staff
    if (role === 'Admin' && !isAdmin(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin can create Admin accounts' },
        { status: 403 }
      );
    }

    // Manager cannot create other Manager accounts (only Admin can)
    if (role === 'Manager' && !isAdmin(session.role)) {
      return NextResponse.json(
        { error: 'Only Admin can create Manager accounts' },
        { status: 403 }
      );
    }

    // Check if loginId already exists in this unit
    const existing = await db.user.findUnique({
      where: {
        unitCode_loginId: {
          unitCode: session.unitCode,
          loginId: loginId.trim().toLowerCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this Login ID already exists in this unit' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Use provided permissions or default for the role
    const finalPermissions = permissions
      ? JSON.stringify(permissions)
      : JSON.stringify(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Staff']);

    const user = await db.user.create({
      data: {
        unitCode: session.unitCode,
        loginId: loginId.trim().toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role,
        permissions: finalPermissions,
      },
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'CREATE_USER',
      user.name,
      { loginId: user.loginId, role: user.role },
      request
    );

    return NextResponse.json({
      success: true,
      message: `User "${user.name}" created successfully`,
      user: {
        id: user.id,
        loginId: user.loginId,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create user: ${message}` }, { status: 500 });
  }
}
