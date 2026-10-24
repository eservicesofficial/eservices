import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, logAction } from '@/lib/auth';

// PUT /api/super-admin/forgot-password — Verify security answer (without resetting password)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, securityAnswer } = body;

    if (!email || !securityAnswer) {
      return NextResponse.json(
        { error: 'Email and security answer are required' },
        { status: 400 }
      );
    }

    // Find the super admin by email
    const superAdmin = await db.superAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'Security answer is incorrect' }, { status: 401 });
    }

    if (!superAdmin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Verify security answer (case-insensitive)
    if (superAdmin.securityAnswer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      await logAction(
        'SYSTEM',
        superAdmin.id,
        superAdmin.email,
        'SuperAdmin',
        'FORGOT_PASSWORD_VERIFY_FAILED',
        superAdmin.email,
        { reason: 'incorrect_security_answer' },
        request
      );
      return NextResponse.json({ error: 'Security answer is incorrect' }, { status: 401 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('Verify security answer error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// POST /api/super-admin/forgot-password — Reset Super Admin password using security question
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, securityAnswer, newPassword } = body;

    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { error: 'Email, security answer, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find the super admin by email
    const superAdmin = await db.superAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    if (!superAdmin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Verify security answer (case-insensitive)
    if (superAdmin.securityAnswer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      // Log failed attempt
      await logAction(
        'SYSTEM',
        superAdmin.id,
        superAdmin.email,
        'SuperAdmin',
        'FORGOT_PASSWORD_FAILED',
        superAdmin.email,
        { reason: 'incorrect_security_answer' },
        request
      );
      return NextResponse.json({ error: 'Security answer is incorrect' }, { status: 401 });
    }

    // Hash and update the new password
    const hashedPassword = await hashPassword(newPassword);

    await db.superAdmin.update({
      where: { id: superAdmin.id },
      data: { password: hashedPassword },
    });

    // Log the action
    await logAction(
      'SYSTEM',
      superAdmin.id,
      superAdmin.email,
      'SuperAdmin',
      'FORGOT_PASSWORD_RESET',
      superAdmin.email,
      {},
      request
    );

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

// GET /api/super-admin/forgot-password — Get security question for an email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const superAdmin = await db.superAdmin.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { securityQuestion: true, isActive: true },
    });

    if (!superAdmin) {
      // Don't reveal whether email exists — return a generic question
      return NextResponse.json({ securityQuestion: 'What is your name?' });
    }

    if (!superAdmin.isActive) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    return NextResponse.json({ securityQuestion: superAdmin.securityQuestion });
  } catch (error) {
    console.error('Get security question error:', error);
    return NextResponse.json({ error: 'Failed to fetch security question' }, { status: 500 });
  }
}
