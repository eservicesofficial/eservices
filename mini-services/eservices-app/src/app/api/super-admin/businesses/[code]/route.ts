import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, logAction } from '@/lib/auth';
import { getCategoryTemplate } from '@/lib/category-templates';

// GET /api/super-admin/businesses/[code] — Get business details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unit = await db.unit.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        users: {
          select: {
            id: true, loginId: true, name: true, role: true,
            isActive: true, mustChangePassword: true, lastLogin: true, createdAt: true,
          },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
        },
        settings: true,
      },
    });

    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    // Get counts separately since Unit doesn't have direct relations for invoices/items
    const [invoiceCount, itemCount] = await Promise.all([
      db.invoice.count({ where: { unitCode: code.toUpperCase() } }),
      db.item.count({ where: { unitCode: code.toUpperCase() } }),
    ]);

    // Auto-expire check: if expiresAt has passed, update status
    let effectiveStatus = unit.activationStatus || 'active';
    if (unit.expiresAt && new Date(unit.expiresAt) < new Date() && unit.isActive) {
      await db.unit.update({
        where: { code: unit.code },
        data: { isActive: false, activationStatus: 'expired' },
      });
      effectiveStatus = 'expired';
    }

    return NextResponse.json({
      business: {
        code: unit.code,
        name: unit.name,
        category: unit.category,
        description: unit.description,
        address: unit.address,
        phone: unit.phone,
        email: unit.email,
        gstNumber: unit.gstNumber,
        isActive: effectiveStatus === 'expired' ? false : unit.isActive,
        expiresAt: unit.expiresAt,
        activationStatus: effectiveStatus,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        invoiceCount,
        itemCount,
        settings: unit.settings,
      },
      users: unit.users.map(u => ({
        ...u,
        status: u.isActive ? 'Active' : 'Suspended',
      })),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json({ error: 'Failed to get business' }, { status: 500 });
  }
}

// PUT /api/super-admin/businesses/[code] — Update business
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const body = await request.json();
    const { name, category, address, phone, email, isActive, gstNumber, description, expiresAt, activationStatus } = body;

    const unit = await db.unit.findUnique({ where: { code: code.toUpperCase() } });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category.toUpperCase().trim();
    if (address !== undefined) updateData.address = address.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (gstNumber !== undefined) updateData.gstNumber = gstNumber.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (activationStatus !== undefined) updateData.activationStatus = activationStatus;

    // Auto-expire check: if expiresAt has passed, auto-deactivate
    if (expiresAt && new Date(expiresAt) < new Date()) {
      updateData.isActive = false;
      updateData.activationStatus = 'expired';
    }
    // If reactivating, set status to active
    if (isActive === true && activationStatus === undefined) {
      const currentUnit = await db.unit.findUnique({ where: { code: code.toUpperCase() } });
      if (currentUnit?.activationStatus === 'expired' || currentUnit?.activationStatus === 'suspended') {
        updateData.activationStatus = 'active';
      }
    }

    const updated = await db.unit.update({
      where: { code: code.toUpperCase() },
      data: updateData,
    });

    // CRITICAL FIX: Sync business detail changes to Settings record
    // so shopName, address, phone, email stay in sync between Unit and Settings
    const settingsUpdate: Record<string, unknown> = {};
    if (name !== undefined) settingsUpdate.shopName = name.trim();
    if (address !== undefined) settingsUpdate.shopAddress = address.trim();
    if (phone !== undefined) settingsUpdate.shopPhone = phone.trim();
    if (email !== undefined) settingsUpdate.shopEmail = email.trim();
    if (gstNumber !== undefined) settingsUpdate.gstNumber = gstNumber.trim();

    // ── CATEGORY CHANGE: Auto-sync features and custom fields ──
    // When category changes, remove old-category features and add new-category features
    if (category !== undefined && category.toLowerCase() !== unit.category?.toLowerCase()) {
      const newCategory = category.toLowerCase().trim();
      const template = getCategoryTemplate(newCategory);

      if (template) {
        // Build valid key sets for the new category
        const validFeatureKeys = new Set(template.features.map((f) => f.key));
        const validFieldKeys = new Set(template.itemFields.map((f) => f.key));

        // Remove features that don't belong to the new category
        const existingFeatures = await db.businessFeature.findMany({
          where: { unitCode: code.toUpperCase() },
        });
        const wrongFeatures = existingFeatures.filter((f) => !validFeatureKeys.has(f.key));
        if (wrongFeatures.length > 0) {
          await db.businessFeature.deleteMany({
            where: {
              unitCode: code.toUpperCase(),
              key: { in: wrongFeatures.map((f) => f.key) },
            },
          });
        }

        // Add missing features from the new category template
        const existingFeatureKeys = new Set(existingFeatures.map((f) => f.key));
        const missingFeatures = template.features.filter((f) => !existingFeatureKeys.has(f.key));
        if (missingFeatures.length > 0) {
          await db.businessFeature.createMany({
            data: missingFeatures.map((f) => ({
              unitCode: code.toUpperCase(),
              key: f.key,
              label: f.label,
              module: f.module,
              description: f.description,
              enabled: true,
            })),
          });
        }

        // Remove custom fields that don't belong to the new category
        const existingFields = await db.customItemField.findMany({
          where: { unitCode: code.toUpperCase() },
        });
        const wrongFields = existingFields.filter((f) => !validFieldKeys.has(f.key));
        if (wrongFields.length > 0) {
          await db.customItemField.deleteMany({
            where: {
              unitCode: code.toUpperCase(),
              key: { in: wrongFields.map((f) => f.key) },
            },
          });
        }

        // Add missing custom fields from the new category template
        const existingFieldKeys = new Set(existingFields.map((f) => f.key));
        const missingFields = template.itemFields.filter((f) => !existingFieldKeys.has(f.key));
        if (missingFields.length > 0) {
          await db.customItemField.createMany({
            data: missingFields.map((f) => ({
              unitCode: code.toUpperCase(),
              key: f.key,
              label: f.label,
              fieldType: f.fieldType,
              options: JSON.stringify(f.options ?? []),
              required: f.required,
              sortOrder: f.sortOrder,
              visible: true,
            })),
          });
        }

        // Also update settings defaults for the new category
        const { getCategoryDefaults } = await import('@/lib/sync');
        const categoryDefaults = getCategoryDefaults(newCategory);
        Object.assign(settingsUpdate, categoryDefaults);
        // Don't overwrite shop identity fields
        settingsUpdate.shopName = name?.trim() || unit.name;
        settingsUpdate.shopAddress = address?.trim() || unit.address;
        settingsUpdate.shopPhone = phone?.trim() || unit.phone;
        settingsUpdate.shopEmail = email?.trim() || unit.email;
        settingsUpdate.gstNumber = gstNumber?.trim() || unit.gstNumber;

        console.log(`[CategoryChange] ${code.toUpperCase()}: ${unit.category} → ${newCategory}, -${wrongFeatures.length}/+${missingFeatures.length} features, -${wrongFields.length}/+${missingFields.length} fields`);
      }
    }

    if (Object.keys(settingsUpdate).length > 0) {
      await db.settings.upsert({
        where: { unitCode: code.toUpperCase() },
        update: settingsUpdate,
        create: {
          unitCode: code.toUpperCase(),
          shopName: updated.name || '',
          shopAddress: updated.address || '',
          shopPhone: updated.phone || '',
          shopEmail: updated.email || '',
          gstNumber: updated.gstNumber || '',
          ...settingsUpdate,
        },
      });
    }

    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'UPDATE_BUSINESS', updated.name, { code: updated.code, changes: Object.keys(updateData) }, request);

    return NextResponse.json({ success: true, business: updated });
  } catch (error) {
    console.error('Update business error:', error);
    const errMsg = error instanceof Error ? error.message : 'Failed to update business';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// DELETE /api/super-admin/businesses/[code] — Delete business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const unitCode = code.toUpperCase();

    const unit = await db.unit.findUnique({
      where: { code: unitCode },
    });
    if (!unit) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    // Get counts for logging
    const [userCount, invoiceCount] = await Promise.all([
      db.user.count({ where: { unitCode } }),
      db.invoice.count({ where: { unitCode } }),
    ]);

    // Log before deletion
    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'DELETE_BUSINESS', unit.name, { code: unitCode, users: userCount, invoices: invoiceCount }, request);

    // Cascade delete will remove all related data
    await db.unit.delete({ where: { code: unitCode } });

    return NextResponse.json({ success: true, message: `Business "${unit.name}" (${unitCode}) deleted with all data` });
  } catch (error) {
    console.error('Delete business error:', error);
    return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 });
  }
}
