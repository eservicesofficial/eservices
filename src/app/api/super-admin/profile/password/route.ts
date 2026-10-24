import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, verifyPassword, hashPassword, logAction } from '@/lib/auth';

// PUT /api/super-admin/profile/password — Change super admin password
// Super Admin can change password without old password (currentPassword is optional)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Fetch the super admin with password
    const superAdmin = await db.superAdmin.findUnique({
      where: { id: session.id },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin not found' }, { status: 404 });
    }

    // Current password is required for security
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }
    const isValid = await verifyPassword(currentPassword, superAdmin.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash and update the new password
    const hashedPassword = await hashPassword(newPassword);

    await db.superAdmin.update({
      where: { id: session.id },
      data: { password: hashedPassword },
    });

    // Log the action
    await logAction(
      'SYSTEM',
      session.id,
      session.email,
      'SuperAdmin',
      'CHANGE_PASSWORD',
      session.id,
      { verifiedWithOldPassword: !!currentPassword },
      request
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change super admin password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
