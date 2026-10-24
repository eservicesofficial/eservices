import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createToken, verifyToken, verifyPassword, logAction } from '@/lib/auth';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unitCode, loginId, password } = body;

    if (!unitCode || !loginId || !password) {
      return NextResponse.json(
        { error: 'Unit Code, User ID, and Password are required' },
        { status: 400 }
      );
    }

    // Find the unit
    const unit = await db.unit.findUnique({
      where: { code: unitCode.toUpperCase().trim() },
    });

    if (!unit) {
      return NextResponse.json(
        { error: 'Invalid Unit Code. No business found with this code.' },
        { status: 401 }
      );
    }

    if (!unit.isActive) {
      // Check if expired specifically (by date OR by activationStatus)
      const isExpiredByDate = unit.expiresAt && new Date(unit.expiresAt) < new Date();
      const isExpiredByStatus = unit.activationStatus === 'expired';
      if (isExpiredByDate || isExpiredByStatus) {
        // Auto-expire in DB if not already
        if (unit.activationStatus !== 'expired') {
          await db.unit.update({
            where: { code: unit.code },
            data: { activationStatus: 'expired' },
          }).catch(() => {});
        }
        return NextResponse.json(
          { error: 'Your subscription has expired. Please contact your administrator for renewal.', expired: true, expiresAt: unit.expiresAt, businessName: unit.name },
          { status: 403 }
        );
      }
      const isSuspended = unit.activationStatus === 'suspended';
      return NextResponse.json(
        { error: isSuspended ? 'Your account has been suspended by the administrator.' : 'This unit is currently deactivated. Contact support.', suspended: isSuspended || undefined, businessName: isSuspended ? unit.name : undefined },
        { status: 403 }
      );
    }

    // Check expiry even if still marked active
    if (unit.expiresAt && new Date(unit.expiresAt) < new Date()) {
      // Auto-expire: update status in DB
      await db.unit.update({
        where: { code: unit.code },
        data: { isActive: false, activationStatus: 'expired' },
      });
      return NextResponse.json(
        { error: 'Your subscription has expired. Please contact your administrator for renewal.', expired: true, expiresAt: unit.expiresAt, businessName: unit.name },
        { status: 403 }
      );
    }

    // Find the user within this unit
    const user = await db.user.findUnique({
      where: {
        unitCode_loginId: {
          unitCode: unit.code,
          loginId: loginId.trim().toLowerCase(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid User ID or Password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been suspended. Contact your administrator.', userSuspended: true, businessName: unit.name, clientId: unit.code, userName: user.name, userLoginId: user.loginId },
        { status: 403 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid User ID or Password' },
        { status: 401 }
      );
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Parse permissions
    let permissions = {};
    try {
      permissions = JSON.parse(user.permissions || '{}');
    } catch {
      permissions = {};
    }

    // Create JWT token
    const session = {
      unitCode: unit.code,
      unitName: unit.name,
      userId: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };

    const token = await createToken(session);

    // Log the login action
    await logAction(
      unit.code,
      user.id,
      user.name,
      user.role,
      'LOGIN',
      `Unit: ${unit.name}`,
      { loginId: user.loginId },
      request
    );

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        unitCode: unit.code,
        unitName: unit.name,
        userId: user.id,
        loginId: user.loginId,
        name: user.name,
        role: user.role,
        permissions,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

// GET /api/auth - validate session token (with rolling refresh)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const session = await verifyToken(token);

    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Read fresh user data from DB (not stale JWT) to prevent unitCode/role/permissions drift
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, loginId: true, name: true, role: true,
        permissions: true, isActive: true, mustChangePassword: true, unitCode: true,
      },
    });

    if (!user || !user.isActive) {
      // If user exists but is deactivated, return userSuspended flag for client handling
      if (user && !user.isActive) {
        const userUnit = await db.unit.findUnique({ where: { code: user.unitCode } });
        return NextResponse.json(
          { error: 'User account suspended', userSuspended: true, businessName: userUnit?.name, clientId: user.unitCode, userName: user.name, userLoginId: user.loginId },
          { status: 401 }
        );
      }
      return NextResponse.json({ error: 'User account not found' }, { status: 401 });
    }

    // Use the user's actual unitCode from DB (not stale JWT) for unit lookup
    const effectiveUnitCode = user.unitCode || session.unitCode;

    // Check if unit is still active
    const unit = await db.unit.findUnique({
      where: { code: effectiveUnitCode },
    });

    if (!unit || !unit.isActive) {
      // Check if expired specifically (by date OR by activationStatus)
      const isExpiredByDate = unit?.expiresAt && new Date(unit.expiresAt) < new Date();
      const isExpiredByStatus = unit?.activationStatus === 'expired';
      if (isExpiredByDate || isExpiredByStatus) {
        // Auto-expire in DB if not already
        if (unit && (!unit.isActive || unit.activationStatus !== 'expired')) {
          await db.unit.update({
            where: { code: unit.code },
            data: { isActive: false, activationStatus: 'expired' },
          }).catch(() => {});
        }
        return NextResponse.json(
          { error: 'Subscription expired', expired: true, expiresAt: unit?.expiresAt, businessName: unit?.name },
          { status: 401 }
        );
      }
      const isSuspended = unit?.activationStatus === 'suspended';
      return NextResponse.json(
        { error: isSuspended ? 'Account suspended' : 'Unit not found or deactivated', suspended: isSuspended || undefined, businessName: isSuspended ? unit?.name : undefined },
        { status: 401 }
      );
    }

    // Check expiry on session validation too
    if (unit.expiresAt && new Date(unit.expiresAt) < new Date()) {
      await db.unit.update({
        where: { code: unit.code },
        data: { isActive: false, activationStatus: 'expired' },
      });
      return NextResponse.json(
        { error: 'Subscription expired', expired: true, expiresAt: unit.expiresAt, businessName: unit.name },
        { status: 401 }
      );
    }

    let freshPermissions = {};
    try {
      freshPermissions = JSON.parse(user.permissions || '{}');
    } catch {
      freshPermissions = {};
    }

    const freshUserData = {
      unitCode: effectiveUnitCode,
      unitName: unit?.name || session.unitName,
      userId: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      permissions: freshPermissions,
      mustChangePassword: user.mustChangePassword,
      isSuperAdmin: session.isSuperAdmin,
    };

    // Issue a new token (rolling refresh) so the JWT stays in sync with the DB
    const newToken = await createToken(freshUserData);

    return NextResponse.json({ valid: true, token: newToken, user: freshUserData });
  } catch (error) {
    console.error('Session validation error:', error);
    return NextResponse.json({ error: 'Session validation failed' }, { status: 500 });
  }
}
