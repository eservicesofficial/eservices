import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, hashPassword, logAction } from '@/lib/auth';

// POST /api/super-admin/businesses/[code]/users/[userId]/reset-password — Force reset password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; userId: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, userId } = await params;
    const unitCode = code.toUpperCase();
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { id: userId, unitCode } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const hashedPassword = await hashPassword(newPassword);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: true },
    });

    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'RESET_PASSWORD', user.name, { unitCode, loginId: user.loginId }, request);

    return NextResponse.json({ success: true, message: `Password reset for "${user.name}". User must change on next login.` });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
