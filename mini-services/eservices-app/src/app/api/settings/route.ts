import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await db.settings.findUnique({ where: { unitCode: session.unitCode } })
    if (!settings) {
      // Settings row missing — recreate using the Unit's business details.
      // This ensures shopName is the actual business name (not empty default)
      // and all contact details are preserved.
      const unit = await db.unit.findUnique({ where: { code: session.unitCode } })
      settings = await db.settings.create({
        data: {
          unitCode: session.unitCode,
          shopName: unit?.name || '',
          shopAddress: unit?.address || '',
          shopPhone: unit?.phone || '',
          shopEmail: unit?.email || '',
          gstNumber: unit?.gstNumber || '',
        },
      })
    }
    // Always return fresh data with no-cache headers to prevent stale data
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { section: _section, ...dbFields } = body

    // Check if this is a thermal settings save — allow any authenticated user
    // Thermal settings are user preferences, not admin-only
    const thermalFields = ['thermalPaperWidth', 'thermalFontSize', 'thermalLineHeight',
      'thermalTextWeight', 'thermalDpi', 'thermalPrintQuality', 'thermalDithering',
      'thermalShowLogo', 'thermalLogo', 'thermalContrast', 'thermalAutoCutLines',
      'thermalCharsPerLine58', 'thermalCharsPerLine80', 'thermalAlignment',
      'thermalMarginTop', 'thermalMarginBottom'];

    const isThermalOnly = Object.keys(dbFields).every(key => thermalFields.includes(key));

    // For non-thermal settings, require settings.edit permission
    if (!isThermalOnly && !sessionHasPermission(session, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const cleanFields: Record<string, unknown> = {}
    // Whitelist of valid settings field names to prevent arbitrary field injection
    const allowedFields = new Set([
      'shopName', 'shopAddress', 'shopEmail', 'shopPhone', 'authorizedSignatory',
      'deliveryCharge', 'enableDelivery', 'enableGst', 'gstFullMode', 'gstSimpleMode',
      'gstRate', 'gstNumber', 'gstState', 'openingTime', 'closingTime',
      'defaultDailyWageRate', 'billAutoGenerate', 'billPrefix', 'billStartNumber',
      'billCurrentNumber', 'autoRotate',
      'thermalFontSize', 'thermalLineHeight', 'thermalTextWeight', 'thermalDpi',
      'thermalPrintQuality', 'thermalDithering', 'thermalContrast', 'thermalPaperWidth',
      'thermalAlignment', 'thermalMarginTop', 'thermalMarginBottom', 'thermalAutoCutLines',
      'thermalCharsPerLine58', 'thermalCharsPerLine80', 'thermalShowLogo', 'thermalLogo',
    ])
    for (const [key, value] of Object.entries(dbFields)) {
      // Only allow whitelisted fields, and filter out undefined/null
      if (allowedFields.has(key) && value !== undefined && value !== null) {
        cleanFields[key] = value
      }
    }

    // CRITICAL FIX: When the upsert needs to CREATE a new settings row
    // (e.g., settings were deleted/missing), we MUST populate business
    // fields from the Unit record instead of relying on Prisma defaults.
    // Without this, a partial update (like thermal-only) would create
    // a row with empty/default shopName, overwriting the real business name.
    const existingSettings = await db.settings.findUnique({ where: { unitCode: session.unitCode } })

    let settings;
    if (existingSettings) {
      // Normal update path — just update the existing row
      settings = await db.settings.update({
        where: { unitCode: session.unitCode },
        data: cleanFields,
      })

      // BIDIRECTIONAL SYNC: When shop fields change in Settings, sync back to Unit
      const unitSyncFields: Record<string, string> = {
        shopName: 'name',
        shopAddress: 'address',
        shopPhone: 'phone',
        shopEmail: 'email',
        gstNumber: 'gstNumber',
      };
      const unitUpdates: Record<string, string> = {};
      for (const [settingsKey, unitKey] of Object.entries(unitSyncFields)) {
        if (settingsKey in cleanFields && cleanFields[settingsKey] !== undefined) {
          unitUpdates[unitKey] = String(cleanFields[settingsKey]);
        }
      }
      if (Object.keys(unitUpdates).length > 0) {
        await db.unit.update({
          where: { code: session.unitCode },
          data: unitUpdates,
        }).catch(() => {}); // Don't fail if Unit doesn't exist
      }
    } else {
      // Creating new settings row — always include Unit business details as base
      const unit = await db.unit.findUnique({ where: { code: session.unitCode } })
      const businessDefaults = {
        shopName: unit?.name || '',
        shopAddress: unit?.address || '',
        shopPhone: unit?.phone || '',
        shopEmail: unit?.email || '',
        gstNumber: unit?.gstNumber || '',
      }
      settings = await db.settings.create({
        data: {
          unitCode: session.unitCode,
          ...businessDefaults,
          ...cleanFields,
        },
      })
    }

    // Log settings change (session is guaranteed non-null at this point)
    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'UPDATE_SETTINGS',
      _section || 'General',
      { fields: Object.keys(cleanFields) },
      request
    )

    // Return fresh data with no-cache headers
    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
