import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, isAdmin, isAdminOrManager, hashPassword, verifyPassword, logAction, canModifySystem, canResetPassword, hasPermissionFromDB, ROLE_LEVELS } from '@/lib/auth';

// GET /api/users/[id] - get single user (Admin or user with userManagement permission)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewUsers = isAdmin(session.role) || await hasPermissionFromDB(session.userId, session.role, 'settings', 'userManagement');
    if (!canViewUsers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const user = await db.user.findFirst({
      where: { id, unitCode: session.unitCode },
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
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse permissions from JSON string to object
    let parsedPerms = {};
    try {
      parsedPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || {});
    } catch {
      parsedPerms = {};
    }

    return NextResponse.json({
      user: {
        ...user,
        permissions: parsedPerms,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// PUT /api/users/[id] - update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission to manage users (from DB, real-time)
    const canManageUsers = isAdmin(session.role) || await hasPermissionFromDB(session.userId, session.role, 'settings', 'userManagement');
    if (!canManageUsers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, role, permissions, password, isActive, status, currentPassword } = body;
    const isPasswordOnly = body._passwordOnly === true;

    const existingUser = await db.user.findFirst({
      where: { id, unitCode: session.unitCode },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwnAccount = id === session.userId;
    const isChangingPassword = !!password;

    // ── Password change logic ──
    if (isChangingPassword) {
      if (isOwnAccount) {
        // Changing own password
        // Admin and Manager can change own password without old password
        // Cashier and Staff need current password
        if (session.role === 'Admin' || session.role === 'Manager') {
          // No old password needed - proceed
        } else {
          const currentPwd = currentPassword;
          if (!currentPwd) {
            return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
          }
          const currentValid = await verifyPassword(currentPwd, existingUser.password);
          if (!currentValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
          }
        }
      } else {
        // Changing another user's password — hierarchy check
        if (!canResetPassword(session.role, existingUser.role)) {
          return NextResponse.json(
            { error: `You cannot reset this user's password. Only higher roles can reset passwords.` },
            { status: 403 }
          );
        }
        // No old password needed for Admin/Manager resetting other user's password
      }
    }

    // ── System changes (role, permissions, status) - hierarchy check ──
    // Compute effectiveIsActive here so it's available in the update section below
    const effectiveIsActive = isActive !== undefined ? isActive : (status === 'Active' ? true : status === 'Suspended' ? false : undefined);

    if (!isPasswordOnly) {
      // Check if trying to modify another user's system settings
      if (id !== session.userId) {
        if (!canModifySystem(session.role, existingUser.role)) {
          return NextResponse.json(
            { error: `You cannot modify this user's settings. Only higher roles can update lower role users.` },
            { status: 403 }
          );
        }
      }

      // Prevent changing own role (can't promote/demote yourself)
      if (role && id === session.userId && role !== existingUser.role) {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
      }

      // Prevent admin from deactivating themselves
      if (effectiveIsActive === false && id === session.userId) {
        return NextResponse.json(
          { error: 'You cannot suspend your own account' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined && !isPasswordOnly) {
      const validRoles = ['Admin', 'Manager', 'Cashier', 'Staff'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      // Only allow setting role if actor has higher authority
      if (!isPasswordOnly && role !== existingUser.role) {
        if (!canModifySystem(session.role, role)) {
          return NextResponse.json({ error: `You cannot assign role "${role}". Insufficient authority.` }, { status: 403 });
        }
      }
      updateData.role = role;
    }
    if (permissions !== undefined && !isPasswordOnly) updateData.permissions = JSON.stringify(permissions);
    if (!isPasswordOnly && effectiveIsActive !== undefined) updateData.isActive = effectiveIsActive;
    if (password) {
      updateData.password = await hashPassword(password);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes to update' }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    });

    // Determine the action type for audit log
    const actionType = isPasswordOnly ? 'CHANGE_PASSWORD' : 'UPDATE_USER';

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      actionType,
      existingUser.name,
      {
        changes: Object.keys(updateData),
        targetRole: existingUser.role,
        isOwnAccount: id === session.userId,
      },
      request
    );

    return NextResponse.json({
      success: true,
      message: isPasswordOnly
        ? `Password changed for "${existingUser.name}"`
        : `User "${existingUser.name}" updated successfully`,
      user: {
        id: updatedUser.id,
        loginId: updatedUser.loginId,
        name: updatedUser.name,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update user: ${message}` }, { status: 500 });
  }
}

// DELETE /api/users/[id] - delete user (Admin only, hierarchy enforced)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canManageUsers = isAdmin(session.role) || await hasPermissionFromDB(session.userId, session.role, 'settings', 'userManagement');
    if (!canManageUsers) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (id === session.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findFirst({
      where: { id, unitCode: session.unitCode },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hierarchy check: only higher role can delete lower role
    if (!canModifySystem(session.role, existingUser.role)) {
      return NextResponse.json(
        { error: `You cannot delete this user. Only higher roles can delete lower role users.` },
        { status: 403 }
      );
    }

    await db.user.delete({ where: { id } });

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'DELETE_USER',
      existingUser.name,
      { loginId: existingUser.loginId, role: existingUser.role },
      request
    );

    return NextResponse.json({
      success: true,
      message: `User "${existingUser.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
