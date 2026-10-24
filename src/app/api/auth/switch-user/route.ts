import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, isAdmin, createToken, logAction } from '@/lib/auth';

// POST /api/auth/switch-user - Admin/Manager switches to another user's account
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin or Manager can switch users
    if (!isAdmin(session.role) && session.role !== 'Manager') {
      return NextResponse.json(
        { error: 'Access denied. Only Admin or Manager can switch users.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      );
    }

    // Find the target user
    const targetUser = await db.user.findFirst({
      where: { id: targetUserId, unitCode: session.unitCode },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Target user not found in this unit' },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: 'Target user account is suspended' },
        { status: 403 }
      );
    }

    // Manager can only switch to Cashier or Staff (not Admin or other Managers)
    if (!isAdmin(session.role) && (targetUser.role === 'Admin' || targetUser.role === 'Manager')) {
      return NextResponse.json(
        { error: 'Manager can only switch to Cashier or Staff accounts' },
        { status: 403 }
      );
    }

    // Parse permissions for the target user
    let permissions = {};
    try {
      permissions = JSON.parse(targetUser.permissions || '{}');
    } catch {
      permissions = {};
    }

    // Use target user's actual unitCode from DB (not stale JWT) and read fresh unitName
    const effectiveUnitCode = targetUser.unitCode || session.unitCode;
    const unit = await db.unit.findUnique({
      where: { code: effectiveUnitCode },
    });
    const unitName = unit?.name || effectiveUnitCode;

    // Create a new JWT for the target user
    const newSession = {
      unitCode: effectiveUnitCode,
      unitName,
      userId: targetUser.id,
      loginId: targetUser.loginId,
      name: targetUser.name,
      role: targetUser.role,
      permissions,
      mustChangePassword: targetUser.mustChangePassword,
    };

    const newToken = await createToken(newSession);

    // Log the switch action
    await logAction(
      effectiveUnitCode,
      session.userId,
      session.name,
      session.role,
      'SWITCH_USER',
      targetUser.name,
      {
        targetLoginId: targetUser.loginId,
        targetRole: targetUser.role,
        switchedTo: targetUser.name,
      },
      request
    );

    return NextResponse.json({
      success: true,
      message: `Switched to ${targetUser.name}'s account`,
      token: newToken,
      user: {
        unitCode: effectiveUnitCode,
        unitName,
        userId: targetUser.id,
        loginId: targetUser.loginId,
        name: targetUser.name,
        role: targetUser.role,
        permissions,
      },
    });
  } catch (error) {
    console.error('Switch user error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to switch user: ${message}` }, { status: 500 });
  }
}
