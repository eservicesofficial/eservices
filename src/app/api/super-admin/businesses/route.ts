import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, generateClientCode, hashPassword, logAction, ROLE_PERMISSIONS } from '@/lib/auth';
import { getCategoryDefaults } from '@/lib/sync';
import { getCategoryTemplate } from '@/lib/category-templates';

// GET /api/super-admin/businesses — List all businesses
export async function GET(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const businesses = await db.unit.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, features: true, customFields: true } },
      },
    });

    // Get invoice counts per unit
    const invoiceCounts = await db.invoice.groupBy({
      by: ['unitCode'],
      _count: { id: true },
    });
    const invoiceMap = Object.fromEntries(invoiceCounts.map(i => [i.unitCode, i._count.id]));

    // Auto-expire check: update any businesses whose expiry has passed
    for (const b of businesses) {
      if (b.expiresAt && new Date(b.expiresAt) < new Date() && b.isActive) {
        await db.unit.update({
          where: { code: b.code },
          data: { isActive: false, activationStatus: 'expired' },
        });
        b.isActive = false;
        b.activationStatus = 'expired';
      }
    }

    const result = businesses.map(b => ({
      code: b.code,
      name: b.name,
      category: b.category,
      description: b.description,
      address: b.address,
      phone: b.phone,
      email: b.email,
      gstNumber: b.gstNumber,
      isActive: b.isActive,
      expiresAt: b.expiresAt,
      activationStatus: b.activationStatus || 'active',
      userCount: b._count.users,
      featureCount: b._count.features,
      customFieldCount: b._count.customFields,
      invoiceCount: invoiceMap[b.code] || 0,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return NextResponse.json({ businesses: result }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('List businesses error:', error);
    return NextResponse.json({ error: 'Failed to list businesses' }, { status: 500 });
  }
}

// POST /api/super-admin/businesses — Create new business
export async function POST(request: NextRequest) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { name, category, address, phone, email, adminName, adminPhone, gstNumber } = body;

    if (!name || !category || !adminName) {
      return NextResponse.json(
        { error: 'Business name, category, and admin name are required' },
        { status: 400 }
      );
    }

    // Auto-generate Client ID
    const code = await generateClientCode(category);

    // Create the business
    const unit = await db.unit.create({
      data: {
        code,
        name: name.trim(),
        category: category.toUpperCase().trim(),
        address: address?.trim() || '',
        phone: phone?.trim() || '',
        email: email?.trim() || '',
        gstNumber: gstNumber?.trim() || '',
      },
    });

    // Auto-create first Admin user
    const tempPassword = `${code}@${new Date().getFullYear()}`;
    const hashedPassword = await hashPassword(tempPassword);

    const admin = await db.user.create({
      data: {
        unitCode: code,
        loginId: 'admin',
        password: hashedPassword,
        name: adminName.trim(),
        role: 'Admin',
        permissions: JSON.stringify(ROLE_PERMISSIONS.Admin),
        mustChangePassword: true,
      },
    });

    // Create default settings with category-specific defaults
    const categoryDefaults = getCategoryDefaults(category);
    await db.settings.create({
      data: {
        unitCode: code,
        shopName: name.trim(),
        shopAddress: address?.trim() || '',
        shopPhone: phone?.trim() || '',
        shopEmail: email?.trim() || '',
        gstNumber: gstNumber?.trim() || '',
        ...categoryDefaults,
      },
    });

    // Auto-create category-specific features and custom item fields
    const template = getCategoryTemplate(category);
    if (template) {
      // Create BusinessFeature rows
      if (template.features.length > 0) {
        await db.businessFeature.createMany({
          data: template.features.map((f) => ({
            unitCode: code,
            key: f.key,
            label: f.label,
            module: f.module,
            description: f.description,
            enabled: true,
          })),
        });
      }

      // Create CustomItemField rows
      if (template.itemFields.length > 0) {
        await db.customItemField.createMany({
          data: template.itemFields.map((f) => ({
            unitCode: code,
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
    }

    // Log the action
    await logAction('SYSTEM', session.id, session.name, 'SuperAdmin', 'CREATE_BUSINESS', unit.name, { code, adminName }, request);

    return NextResponse.json({
      success: true,
      business: { code, name: unit.name, category: unit.category },
      admin: {
        loginId: 'admin',
        temporaryPassword: tempPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    console.error('Create business error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create business: ${message}` }, { status: 500 });
  }
}
