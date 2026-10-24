import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, logAction } from '@/lib/auth';

// GET /api/super-admin/profile — Get current super admin profile
export async function GET(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        securityQuestion: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin not found' }, { status: 404 });
    }

    return NextResponse.json({ profile: superAdmin });
  } catch (error) {
    console.error('Get super admin profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT /api/super-admin/profile — Update super admin email and/or name
export async function PUT(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, name, securityQuestion, securityAnswer } = body;

    // Build update data
    const updateData: { email?: string; name?: string; securityQuestion?: string; securityAnswer?: string } = {};

    if (email !== undefined) {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return NextResponse.json({ error: 'Email cannot be empty' }, { status: 400 });
      }

      // Check uniqueness against other SuperAdmins
      const existing = await db.superAdmin.findFirst({
        where: {
          email: trimmedEmail,
          id: { not: session.id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: 'Email is already in use by another super admin' }, { status: 409 });
      }

      updateData.email = trimmedEmail;
    }

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (securityQuestion !== undefined) {
      updateData.securityQuestion = securityQuestion.trim();
    }

    if (securityAnswer !== undefined) {
      updateData.securityAnswer = securityAnswer.trim().toLowerCase();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await db.superAdmin.update({
      where: { id: session.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        securityQuestion: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    // Log the action
    await logAction(
      'SYSTEM',
      session.id,
      session.email,
      'SuperAdmin',
      'UPDATE_PROFILE',
      session.id,
      { updatedFields: Object.keys(updateData) },
      request
    );

    return NextResponse.json({ profile: updated });
  } catch (error) {
    console.error('Update super admin profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
