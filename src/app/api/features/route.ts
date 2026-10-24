import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/features — Get all features for the current business
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const unitCode = session.unitCode;

    // Query features and unit in parallel
    const [features, unit] = await Promise.all([
      db.businessFeature.findMany({
        where: { unitCode },
        orderBy: [{ module: 'asc' }, { label: 'asc' }],
      }),
      db.unit.findUnique({ where: { code: unitCode }, select: { category: true } }),
    ]);

    // Group features by module
    const grouped: Record<string, typeof features> = {};
    for (const f of features) {
      if (!grouped[f.module]) grouped[f.module] = [];
      grouped[f.module].push(f);
    }

    // Build a quick lookup map: key → enabled
    const featureMap: Record<string, boolean> = {};
    for (const f of features) {
      featureMap[f.key] = f.enabled;
    }

    return NextResponse.json({
      features,
      grouped,
      featureMap,
      category: unit?.category ?? '',
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Get features error:', error);
    return NextResponse.json({ error: 'Failed to get features' }, { status: 500 });
  }
}

// PUT /api/features — Toggle a feature (for admin users of the business)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'Admin') return NextResponse.json({ error: 'Only admins can modify features' }, { status: 403 });

    const { featureId, enabled } = await request.json();
    if (!featureId || enabled === undefined) {
      return NextResponse.json({ error: 'featureId and enabled are required' }, { status: 400 });
    }

    // Verify feature belongs to this business
    const feature = await db.businessFeature.findUnique({ where: { id: featureId } });
    if (!feature || feature.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const updated = await db.businessFeature.update({
      where: { id: featureId },
      data: { enabled },
    });

    return NextResponse.json({ success: true, feature: updated });
  } catch (error) {
    console.error('Update feature error:', error);
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 });
  }
}
