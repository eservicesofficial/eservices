import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest } from '@/lib/auth';

// GET /api/super-admin/businesses/[code]/custom-fields — Get all custom fields for a business
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

    const fields = await db.customItemField.findMany({
      where: { unitCode: code },
      orderBy: { sortOrder: 'asc' },
    });

    // Parse options JSON for each field
    const parsedFields = fields.map((f) => ({
      ...f,
      options: JSON.parse(f.options || '[]'),
    }));

    return NextResponse.json({ fields: parsedFields });
  } catch (error) {
    console.error('Get custom fields error:', error);
    return NextResponse.json({ error: 'Failed to get custom fields' }, { status: 500 });
  }
}

// PUT /api/super-admin/businesses/[code]/custom-fields — Update a custom field
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
    const { fieldId, label, fieldType, options, required, visible, sortOrder } = body;

    if (!fieldId) {
      return NextResponse.json({ error: 'fieldId is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (fieldType !== undefined) updateData.fieldType = fieldType;
    if (options !== undefined) updateData.options = JSON.stringify(options);
    if (required !== undefined) updateData.required = required;
    if (visible !== undefined) updateData.visible = visible;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const field = await db.customItemField.updateMany({
      where: { id: fieldId, unitCode: code },
      data: updateData,
    });

    if (field.count === 0) {
      return NextResponse.json({ error: 'Custom field not found in this business' }, { status: 404 });
    }

    return NextResponse.json({ success: true, field });
  } catch (error) {
    console.error('Update custom field error:', error);
    return NextResponse.json({ error: 'Failed to update custom field' }, { status: 500 });
  }
}

// POST /api/super-admin/businesses/[code]/custom-fields — Add a new custom field
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
    const { key, label, fieldType, options, required, sortOrder } = body;

    if (!key || !label) {
      return NextResponse.json({ error: 'key and label are required' }, { status: 400 });
    }

    // Check for duplicate key
    const existing = await db.customItemField.findUnique({
      where: { unitCode_key: { unitCode: code, key } },
    });
    if (existing) {
      return NextResponse.json({ error: 'A field with this key already exists' }, { status: 409 });
    }

    // Get max sortOrder
    const maxSort = await db.customItemField.findFirst({
      where: { unitCode: code },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const field = await db.customItemField.create({
      data: {
        unitCode: code,
        key: key.trim(),
        label: label.trim(),
        fieldType: fieldType || 'text',
        options: JSON.stringify(options ?? []),
        required: required ?? false,
        sortOrder: sortOrder ?? (maxSort?.sortOrder ?? 0) + 1,
        visible: true,
      },
    });

    return NextResponse.json({ success: true, field }, { status: 201 });
  } catch (error) {
    console.error('Create custom field error:', error);
    return NextResponse.json({ error: 'Failed to create custom field' }, { status: 500 });
  }
}

// DELETE /api/super-admin/businesses/[code]/custom-fields — Delete a custom field
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await params;
    const { fieldId } = await request.json();

    if (!fieldId) {
      return NextResponse.json({ error: 'fieldId is required' }, { status: 400 });
    }

    await db.customItemField.deleteMany({
      where: { id: fieldId, unitCode: code },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete custom field error:', error);
    return NextResponse.json({ error: 'Failed to delete custom field' }, { status: 500 });
  }
}
