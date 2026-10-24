import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, logAction } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: true });
    }

    await logAction(
      session.unitCode,
      session.userId,
      session.loginId,
      session.role,
      'LOGOUT',
      `Session ended`,
      { loginId: session.loginId },
      request
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true });
  }
}
