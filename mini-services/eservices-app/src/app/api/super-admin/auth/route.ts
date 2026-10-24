import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createSuperAdminToken, verifySuperAdminToken } from '@/lib/auth';

// POST /api/super-admin/auth — Super Admin Login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and Password are required' }, { status: 400 });
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!superAdmin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    const valid = await verifyPassword(password, superAdmin.password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Update last login
    await db.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLogin: new Date() },
    });

    const session = {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      isSuperAdmin: true as const,
    };

    const token = await createSuperAdminToken(session);

    return NextResponse.json({
      success: true,
      token,
      user: session,
    });
  } catch (error) {
    console.error('Super admin auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

// GET /api/super-admin/auth — Validate Super Admin session
export async function GET(request: NextRequest) {
  try {
    const session = await verifySuperAdminToken(
      request.headers.get('authorization')?.replace('Bearer ', '') || ''
    );
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Check if super admin still exists and is active
    const superAdmin = await db.superAdmin.findUnique({ where: { id: session.id } });
    if (!superAdmin || !superAdmin.isActive) {
      return NextResponse.json({ error: 'Account not found or deactivated' }, { status: 401 });
    }

    return NextResponse.json({ valid: true, user: session });
  } catch (error) {
    console.error('Super admin session validation error:', error);
    return NextResponse.json({ error: 'Session validation failed' }, { status: 500 });
  }
}
