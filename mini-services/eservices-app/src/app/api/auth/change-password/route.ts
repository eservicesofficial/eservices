import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, verifyPassword, hashPassword, logAction, createToken } from '@/lib/auth';

// POST /api/auth/change-password — Change own password
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.user.update({
      where: { id: session.userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'PASSWORD_CHANGE',
      'Self',
      {},
      request
    );

    // Read fresh user data from DB (not stale JWT) to keep unitCode/unitName/role/permissions in sync
    const freshUser = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, loginId: true, name: true, role: true,
        permissions: true, mustChangePassword: true, unitCode: true,
      },
    });

    let freshPermissions = {};
    try {
      freshPermissions = JSON.parse(freshUser?.permissions || '{}');
    } catch {
      freshPermissions = {};
    }

    const effectiveUnitCode = freshUser?.unitCode || session.unitCode;
    const unit = await db.unit.findUnique({ where: { code: effectiveUnitCode }, select: { name: true } });

    const newSession = {
      unitCode: effectiveUnitCode,
      unitName: unit?.name || session.unitName,
      userId: freshUser?.id || session.userId,
      loginId: freshUser?.loginId || session.loginId,
      name: freshUser?.name || session.name,
      role: freshUser?.role || session.role,
      permissions: freshPermissions || session.permissions,
      mustChangePassword: false,
    };
    const newToken = await createToken(newSession);

    return NextResponse.json({ success: true, message: 'Password changed successfully', token: newToken, user: newSession });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
