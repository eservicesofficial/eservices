import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, createToken, createSuperAdminToken } from '@/lib/auth';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

// GET /api/auth/session - get fresh session with latest permissions from DB
// Also issues a renewed JWT token (rolling refresh) to prevent session expiry
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try regular user token first, then super admin token
    let session: AuthSession | null = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Super Admin session refresh ──
    // Note: getSessionFromRequest already handles the super admin fallback
    // internally, so session.isSuperAdmin will be true for super admin tokens.
    if (session.isSuperAdmin) {
      // Verify super admin still exists and is active
      const sa = await db.superAdmin.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, isActive: true },
      });

      if (!sa || !sa.isActive) {
        return NextResponse.json({ error: 'Super admin account not found or deactivated' }, { status: 401 });
      }

      // Issue a new token (rolling refresh) to keep the session alive
      const newToken = await createSuperAdminToken({
        id: sa.id,
        email: sa.email,
        name: sa.name,
        isSuperAdmin: true,
      });

      return NextResponse.json({
        valid: true,
        token: newToken,
        user: {
          unitCode: 'SUPER',
          unitName: 'System',
          userId: sa.id,
          loginId: sa.email,
          name: sa.name,
          role: 'SuperAdmin',
          permissions: {},
          isSuperAdmin: true,
        },
      });
    }

    // ── Regular user session refresh ──
    // Read fresh user data from DB (not from JWT)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        loginId: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        mustChangePassword: true,
        unitCode: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'User not found or suspended' }, { status: 401 });
    }

    // Use the user's actual unitCode from DB (in case it was changed, e.g., client ID change)
    const effectiveUnitCode = user.unitCode || session.unitCode;

    // Check unit expiry status
    const unit = await db.unit.findUnique({
      where: { code: effectiveUnitCode },
      select: { isActive: true, expiresAt: true, activationStatus: true, name: true },
    });

    if (!unit || !unit.isActive) {
      // Check if expired specifically (by date OR by activationStatus)
      const isExpiredByDate = unit?.expiresAt && new Date(unit.expiresAt) < new Date();
      const isExpiredByStatus = unit?.activationStatus === 'expired';
      if (isExpiredByDate || isExpiredByStatus) {
        // Auto-expire in DB if not already
        if (unit && unit.activationStatus !== 'expired') {
          await db.unit.update({
            where: { code: effectiveUnitCode },
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
        { error: isSuspended ? 'Account suspended' : 'Unit deactivated', suspended: isSuspended || undefined, businessName: isSuspended ? unit?.name : undefined },
        { status: 401 }
      );
    }

    if (unit.expiresAt && new Date(unit.expiresAt) < new Date()) {
      await db.unit.update({
        where: { code: effectiveUnitCode },
        data: { isActive: false, activationStatus: 'expired' },
      });
      return NextResponse.json(
        { error: 'Subscription expired', expired: true, expiresAt: unit.expiresAt, businessName: unit.name },
        { status: 401 }
      );
    }

    // Parse permissions from DB (fresh, not from JWT)
    let freshPermissions = {};
    try {
      freshPermissions = JSON.parse(user.permissions || '{}');
    } catch {
      freshPermissions = {};
    }

    const freshUser = {
      unitCode: effectiveUnitCode,
      unitName: unit?.name || session.unitName,  // Use fresh name from DB, not stale JWT
      userId: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      permissions: freshPermissions,
      mustChangePassword: user.mustChangePassword,
    };

    // Issue a new token (rolling refresh) to keep the session alive.
    // This prevents users from being logged out after 24h of inactivity
    // as long as they are actively using the app.
    const newToken = await createToken(freshUser);

    return NextResponse.json({
      valid: true,
      token: newToken,
      user: freshUser,
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json({ error: 'Session refresh failed' }, { status: 500 });
  }
}
