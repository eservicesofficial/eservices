import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, hashPassword, logAction, ROLE_PERMISSIONS } from '@/lib/auth';

// GET /api/super-admin/businesses/[code]/users/[userId] — Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; userId: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, userId } = await params;
    const user = await db.user.findFirst({
      where: { id: userId, unitCode: code.toUpperCase() },
      select: {
        id: true, loginId: true, name: true, role: true,
        permissions: true, isActive: true, mustChangePassword: true,
        lastLogin: true, createdAt: true, updatedAt: true, unitCode: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let parsedPerms = {};
    try { parsedPerms = JSON.parse(user.permissions || '{}'); } catch { parsedPerms = {}; }

    return NextResponse.json({ user: { ...user, permissions: parsedPerms, status: user.isActive ? 'Active' : 'Suspended' } });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// PUT /api/super-admin/businesses/[code]/users/[userId] — Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; userId: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, userId } = await params;
    const unitCode = code.toUpperCase();
    const body = await request.json();

    const user = await db.user.findFirst({ where: { id: userId, unitCode } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (body.loginId !== undefined) {
      const trimmedLoginId = body.loginId.trim();
      if (!trimmedLoginId) {
        return NextResponse.json({ error: 'Login ID cannot be empty' }, { status: 400 });
      }
      // Check for duplicate loginId in the same unit
      if (trimmedLoginId !== user.loginId) {
        const existing = await db.user.findFirst({
          where: { unitCode, loginId: trimmedLoginId, id: { not: userId } },
        });
        if (existing) {
          return NextResponse.json({ error: 'Login ID is already in use by another user in this business' }, { status: 409 });
        }
      }
      updateData.loginId = trimmedLoginId;
    }
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.role !== undefined) {
      const validRoles = ['Admin', 'Manager', 'Cashier', 'Staff'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = body.role;
    }
    if (body.permissions !== undefined) updateData.permissions = JSON.stringify(body.permissions);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.mustChangePassword !== undefined) updateData.mustChangePassword = body.mustChangePassword;
    if (body.password) {
      if (body.password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }
      updateData.password = await hashPassword(body.password);
      updateData.mustChangePassword = true;
    }

    const updated = await db.user.update({ where: { id: userId }, data: updateData });

    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'UPDATE_USER', updated.name, { unitCode, loginId: updated.loginId, changes: Object.keys(updateData) }, request);

    return NextResponse.json({
      success: true,
      user: { id: updated.id, loginId: updated.loginId, name: updated.name, role: updated.role, isActive: updated.isActive, mustChangePassword: updated.mustChangePassword },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/super-admin/businesses/[code]/users/[userId] — Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; userId: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, userId } = await params;
    const unitCode = code.toUpperCase();

    const user = await db.user.findFirst({ where: { id: userId, unitCode } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Prevent deleting the last Admin
    if (user.role === 'Admin') {
      const adminCount = await db.user.count({ where: { unitCode, role: 'Admin', isActive: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last Admin user' }, { status: 400 });
      }
    }

    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'DELETE_USER', user.name, { unitCode, loginId: user.loginId, role: user.role }, request);

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true, message: `User "${user.loginId}" deleted` });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
