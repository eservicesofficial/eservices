import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSuperAdminFromRequest, logAction } from '@/lib/auth';

// PUT /api/super-admin/businesses/[code]/change-client-id — Change a business's Client ID
// This is a CRITICAL operation that updates ALL related records atomically.
// Since Unit.code is the primary key and SQLite cannot update PKs directly,
// we: update all child tables → create new Unit → delete old Unit
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // 1. Verify super admin token
    const session = await getSuperAdminFromRequest(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Get current code from URL params
    const { code } = await params;
    const oldCode = code.toUpperCase();

    // 3. Accept and validate body
    const body = await request.json();
    const { newCode } = body;

    // 4. Validate newCode: non-empty, alphanumeric + uppercase, 2-20 chars
    if (!newCode || typeof newCode !== 'string') {
      return NextResponse.json({ error: 'newCode is required' }, { status: 400 });
    }

    const normalizedNewCode = newCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{2,20}$/.test(normalizedNewCode)) {
      return NextResponse.json(
        { error: 'newCode must be 2-20 characters, alphanumeric (uppercase only)' },
        { status: 400 }
      );
    }

    if (normalizedNewCode === oldCode) {
      return NextResponse.json({ error: 'newCode must be different from current code' }, { status: 400 });
    }

    // 5. Check current business exists
    const existingUnit = await db.unit.findUnique({ where: { code: oldCode } });
    if (!existingUnit) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // 6. Check newCode doesn't already exist
    const conflictingUnit = await db.unit.findUnique({ where: { code: normalizedNewCode } });
    if (conflictingUnit) {
      return NextResponse.json({ error: 'A business with this Client ID already exists' }, { status: 409 });
    }

    // 7. Atomic transaction: update ALL related records
    await db.$transaction(async (tx) => {
      // --- Step A: Update all child tables that do NOT have FK constraints on unitCode ---
      // These tables just have unitCode as a plain indexed field
      await tx.category.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.item.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.invoice.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.refund.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.pettyCashTransaction.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.khataProfile.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.staffProfile.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.calcHistory.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.auditLog.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });

      // --- Step B: Create new Unit record with newCode (copying all fields) ---
      // We must create the new Unit BEFORE updating FK-constrained child tables
      // so the FK reference is satisfied
      await tx.unit.create({
        data: {
          code: normalizedNewCode,
          name: existingUnit.name,
          category: existingUnit.category,
          description: existingUnit.description,
          address: existingUnit.address,
          phone: existingUnit.phone,
          email: existingUnit.email,
          gstNumber: existingUnit.gstNumber,
          isActive: existingUnit.isActive,
          expiresAt: existingUnit.expiresAt,
          activationStatus: existingUnit.activationStatus,
          createdAt: existingUnit.createdAt,
          updatedAt: existingUnit.updatedAt,
        },
      });

      // --- Step C: Update User.unitCode (FK constraint to Unit.code) ---
      // Now the newCode exists in Unit, so FK is satisfied
      await tx.user.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });

      // --- Step C2: Update BusinessFeature & CustomItemField (FK constraint to Unit.code) ---
      await tx.businessFeature.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });
      await tx.customItemField.updateMany({ where: { unitCode: oldCode }, data: { unitCode: normalizedNewCode } });

      // --- Step D: Update Settings (unitCode is BOTH PK and FK) ---
      // We need to read all Settings, create new ones, then delete old ones
      const oldSettings = await tx.settings.findUnique({ where: { unitCode: oldCode } });
      if (oldSettings) {
        await tx.settings.create({
          data: {
            unitCode: normalizedNewCode,
            shopName: oldSettings.shopName,
            shopAddress: oldSettings.shopAddress,
            shopEmail: oldSettings.shopEmail,
            shopPhone: oldSettings.shopPhone,
            authorizedSignatory: oldSettings.authorizedSignatory,
            deliveryCharge: oldSettings.deliveryCharge,
            enableDelivery: oldSettings.enableDelivery,
            enableGst: oldSettings.enableGst,
            gstFullMode: oldSettings.gstFullMode,
            gstSimpleMode: oldSettings.gstSimpleMode,
            gstRate: oldSettings.gstRate,
            gstNumber: oldSettings.gstNumber,
            gstState: oldSettings.gstState,
            thermalFontSize: oldSettings.thermalFontSize,
            thermalLineHeight: oldSettings.thermalLineHeight,
            thermalTextWeight: oldSettings.thermalTextWeight,
            thermalDpi: oldSettings.thermalDpi,
            thermalPrintQuality: oldSettings.thermalPrintQuality,
            thermalDithering: oldSettings.thermalDithering,
            thermalContrast: oldSettings.thermalContrast,
            thermalPaperWidth: oldSettings.thermalPaperWidth,
            thermalAlignment: oldSettings.thermalAlignment,
            thermalMarginTop: oldSettings.thermalMarginTop,
            thermalMarginBottom: oldSettings.thermalMarginBottom,
            thermalAutoCutLines: oldSettings.thermalAutoCutLines,
            thermalCharsPerLine58: oldSettings.thermalCharsPerLine58,
            thermalCharsPerLine80: oldSettings.thermalCharsPerLine80,
            thermalShowLogo: oldSettings.thermalShowLogo,
            thermalLogo: oldSettings.thermalLogo,
            openingTime: oldSettings.openingTime,
            closingTime: oldSettings.closingTime,
            defaultDailyWageRate: oldSettings.defaultDailyWageRate,
            billAutoGenerate: oldSettings.billAutoGenerate,
            billPrefix: oldSettings.billPrefix,
            billStartNumber: oldSettings.billStartNumber,
            billCurrentNumber: oldSettings.billCurrentNumber,
            updatedAt: oldSettings.updatedAt,
          },
        });
        await tx.settings.delete({ where: { unitCode: oldCode } });
      }

      // --- Step D2: Update PettyCashConfig (id is PK and stores unitCode, must recreate) ---
      const oldPC = await tx.pettyCashConfig.findFirst({ where: { unitCode: oldCode } });
      if (oldPC) {
        await tx.pettyCashConfig.create({ data: { id: normalizedNewCode, unitCode: normalizedNewCode, amount: oldPC.amount } });
        await tx.pettyCashConfig.delete({ where: { id: oldPC.id } });
      }

      // --- Step E: Delete old Unit record ---
      // All child records now reference newCode, so cascade delete won't lose data
      await tx.unit.delete({ where: { code: oldCode } });
    });

    // 8. Log the action
    await logAction(
      'SYSTEM',
      session.id,
      session.name,
      'SuperAdmin',
      'CHANGE_CLIENT_ID',
      oldCode,
      { oldCode, newCode: normalizedNewCode },
      request
    );

    // 9. Return success
    return NextResponse.json({ success: true, oldCode, newCode: normalizedNewCode });
  } catch (error) {
    console.error('Change client ID error:', error);
    return NextResponse.json({ error: 'Failed to change Client ID' }, { status: 500 });
  }
}
