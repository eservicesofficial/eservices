import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logAction } from '@/lib/auth';

// GET /api/super-admin/recover-email — Get the security question for the first active SuperAdmin
export async function GET() {
  try {
    const superAdmin = await db.superAdmin.findFirst({
      where: { isActive: true },
      select: { securityQuestion: true },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'No active super admin found' }, { status: 404 });
    }

    return NextResponse.json({ securityQuestion: superAdmin.securityQuestion });
  } catch (error) {
    console.error('Get security question for email recovery error:', error);
    return NextResponse.json({ error: 'Failed to fetch security question' }, { status: 500 });
  }
}

// POST /api/super-admin/recover-email — Recover forgotten email using security question
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { securityAnswer } = body;

    if (!securityAnswer) {
      return NextResponse.json(
        { error: 'Security answer is required' },
        { status: 400 }
      );
    }

    // Find the first active SuperAdmin
    const superAdmin = await db.superAdmin.findFirst({
      where: { isActive: true },
    });

    if (!superAdmin) {
      return NextResponse.json({ error: 'No active super admin found' }, { status: 404 });
    }

    // Verify security answer (case-insensitive)
    if (superAdmin.securityAnswer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      // Log failed attempt
      await logAction(
        'SYSTEM',
        superAdmin.id,
        superAdmin.email,
        'SuperAdmin',
        'RECOVER_EMAIL_FAILED',
        superAdmin.email,
        { reason: 'incorrect_security_answer' },
        request
      );
      return NextResponse.json({ error: 'Security answer is incorrect' }, { status: 401 });
    }

    // Log the successful recovery
    await logAction(
      'SYSTEM',
      superAdmin.id,
      superAdmin.email,
      'SuperAdmin',
      'RECOVER_EMAIL_SUCCESS',
      superAdmin.email,
      {},
      request
    );

    return NextResponse.json({
      success: true,
      email: superAdmin.email,
      name: superAdmin.name,
    });
  } catch (error) {
    console.error('Recover email error:', error);
    return NextResponse.json({ error: 'Failed to recover email' }, { status: 500 });
  }
}
