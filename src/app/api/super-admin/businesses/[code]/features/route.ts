import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest } from '@/lib/auth';
import { getCategoryTemplate } from '@/lib/category-templates';

// GET /api/super-admin/businesses/[code]/features — Get all features for a business
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unit = await db.unit.findUnique({ where: { code } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const features = await db.businessFeature.findMany({
      where: { unitCode: code },
      orderBy: [{ module: 'asc' }, { label: 'asc' }],
    });

    // Get the category template for reference
    const template = getCategoryTemplate(unit.category);

    return NextResponse.json({
      features,
      category: unit.category,
      templateFeatures: template?.features ?? [],
    });
  } catch (error) {
    console.error('Get features error:', error);
    return NextResponse.json({ error: 'Failed to get features' }, { status: 500 });
  }
}

// PUT /api/super-admin/businesses/[code]/features — Update feature enabled status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unit = await db.unit.findUnique({ where: { code } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const body = await request.json();
    const { featureId, enabled } = body;

    if (featureId === undefined || enabled === undefined) {
      return NextResponse.json({ error: 'featureId and enabled are required' }, { status: 400 });
    }

    const feature = await db.businessFeature.updateMany({
      where: { id: featureId, unitCode: code },
      data: { enabled },
    });

    if (feature.count === 0) {
      return NextResponse.json({ error: 'Feature not found in this business' }, { status: 404 });
    }

    return NextResponse.json({ success: true, feature });
  } catch (error) {
    console.error('Update feature error:', error);
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 });
  }
}

// POST /api/super-admin/businesses/[code]/features — Apply category template (re-generate features)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unit = await db.unit.findUnique({ where: { code } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const body = await request.json();
    const { category } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const template = getCategoryTemplate(category);
    if (!template) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Get existing features to preserve user customizations (enabled/disabled state)
    const existingFeatures = await db.businessFeature.findMany({ where: { unitCode: code } });
    const existingMap = new Map(existingFeatures.map((f) => [f.key, f]));

    // Build valid key set for the new category
    const validFeatureKeys = new Set(template.features.map((f) => f.key));

    // Remove features that don't belong to this category
    const wrongFeatures = existingFeatures.filter((f) => !validFeatureKeys.has(f.key));
    if (wrongFeatures.length > 0) {
      await db.businessFeature.deleteMany({
        where: {
          unitCode: code,
          key: { in: wrongFeatures.map((f) => f.key) },
        },
      });
    }

    // Upsert features from the template
    const results: Array<{ id: string; key: string; label: string; module: string; description: string; enabled: boolean }> = [];
    for (const f of template.features) {
      const existing = existingMap.get(f.key);
      if (existing) {
        // Feature already exists — keep user's enabled/disabled preference
        results.push(existing);
      } else {
        // New feature from template — create it enabled
        const created = await db.businessFeature.create({
          data: {
            unitCode: code,
            key: f.key,
            label: f.label,
            module: f.module,
            description: f.description,
            enabled: true,
          },
        });
        results.push(created);
      }
    }

    // Similarly upsert custom item fields
    const existingFields = await db.customItemField.findMany({ where: { unitCode: code } });
    const existingFieldMap = new Map(existingFields.map((f) => [f.key, f]));

    // Build valid field keys for the new category
    const validFieldKeys = new Set(template.itemFields.map((f) => f.key));

    // Remove custom fields that don't belong to this category
    const wrongFields = existingFields.filter((f) => !validFieldKeys.has(f.key));
    if (wrongFields.length > 0) {
      await db.customItemField.deleteMany({
        where: {
          unitCode: code,
          key: { in: wrongFields.map((f) => f.key) },
        },
      });
    }

    for (const f of template.itemFields) {
      if (!existingFieldMap.has(f.key)) {
        await db.customItemField.create({
          data: {
            unitCode: code,
            key: f.key,
            label: f.label,
            fieldType: f.fieldType,
            options: JSON.stringify(f.options ?? []),
            required: f.required,
            sortOrder: f.sortOrder,
            visible: true,
          },
        });
      }
    }

    // Update the unit's category (store in uppercase for consistency with business creation)
    await db.unit.update({
      where: { code },
      data: { category: category.toUpperCase().trim() },
    });

    // Also update settings defaults for the new category
    const { getCategoryDefaults } = await import('@/lib/sync');
    const categoryDefaults = getCategoryDefaults(category);
    const settings = await db.settings.findUnique({ where: { unitCode: code } });
    if (settings) {
      await db.settings.update({
        where: { unitCode: code },
        data: {
          ...categoryDefaults,
          // Don't overwrite shop identity fields
          shopName: settings.shopName || unit.name,
          shopAddress: settings.shopAddress || unit.address,
          shopPhone: settings.shopPhone || unit.phone,
          shopEmail: settings.shopEmail || unit.email,
          gstNumber: settings.gstNumber || unit.gstNumber,
        },
      });
    }

    return NextResponse.json({
      success: true,
      featuresApplied: results.length,
      category: category.toUpperCase().trim(),
    });
  } catch (error) {
    console.error('Apply category template error:', error);
    return NextResponse.json({ error: 'Failed to apply category template' }, { status: 500 });
  }
}
