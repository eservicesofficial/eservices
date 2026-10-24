import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, isAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'RESET_DATA', '', {}, request)

    // Use an interactive transaction to delete all data AND recreate settings
    // atomically. This prevents a race condition where another request
    // (e.g., a thermal patch) could create a Settings row with Prisma defaults
    // between the deleteMany and the create.
    await db.$transaction(async (tx) => {
      // Delete all business data belonging to the current unit.
      // Note: User records are intentionally preserved during data reset —
      // they represent access credentials, not business data, and deleting
      // them would lock people out of the system.
      await tx.refund.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.invoiceItem.deleteMany({ where: { invoice: { unitCode: session.unitCode } } })
      await tx.invoice.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.attendance.deleteMany({ where: { profile: { unitCode: session.unitCode } } })
      await tx.staffProfile.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.khataTransaction.deleteMany({ where: { profile: { unitCode: session.unitCode } } })
      await tx.khataProfile.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.pettyCashTransaction.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.pettyCashConfig.deleteMany({ where: { id: session.unitCode } })
      await tx.item.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.category.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.calcHistory.deleteMany({ where: { unitCode: session.unitCode } })

      // Save current settings before deleting so we can preserve key config
      const oldSettings = await tx.settings.findUnique({ where: { unitCode: session.unitCode } })
      await tx.settings.deleteMany({ where: { unitCode: session.unitCode } })

      // Recreate a settings row preserving the Unit's business details AND
      // key configuration (bill generator, GST settings) so they aren't reset
      const unit = await tx.unit.findUnique({ where: { code: session.unitCode } })
      await tx.settings.create({
        data: {
          unitCode: session.unitCode,
          shopName: unit?.name || '',
          shopAddress: unit?.address || '',
          shopPhone: unit?.phone || '',
          shopEmail: unit?.email || '',
          gstNumber: unit?.gstNumber || '',
          // Preserve bill generator settings
          billAutoGenerate: oldSettings?.billAutoGenerate ?? false,
          billPrefix: oldSettings?.billPrefix || '',
          billStartNumber: oldSettings?.billStartNumber ?? 1,
          billCurrentNumber: 0, // Reset counter since bills are cleared
          // Preserve GST settings
          enableGst: oldSettings?.enableGst ?? false,
          gstRate: oldSettings?.gstRate ?? 18,
          gstFullMode: oldSettings?.gstFullMode ?? false,
          gstSimpleMode: oldSettings?.gstSimpleMode ?? false,
          gstState: oldSettings?.gstState || '',
          // Preserve thermal settings
          thermalPaperWidth: oldSettings?.thermalPaperWidth || '80mm',
          thermalFontSize: oldSettings?.thermalFontSize ?? 12,
          thermalLineHeight: oldSettings?.thermalLineHeight ?? 1.4,
          thermalTextWeight: oldSettings?.thermalTextWeight || 'Normal',
          thermalDpi: oldSettings?.thermalDpi ?? 203,
          thermalPrintQuality: oldSettings?.thermalPrintQuality || 'Dark',
          thermalDithering: oldSettings?.thermalDithering || 'None',
          thermalContrast: oldSettings?.thermalContrast ?? 100,
          thermalAlignment: oldSettings?.thermalAlignment || 'center',
          thermalMarginTop: oldSettings?.thermalMarginTop ?? 0,
          thermalMarginBottom: oldSettings?.thermalMarginBottom ?? 0,
          thermalAutoCutLines: oldSettings?.thermalAutoCutLines ?? 3,
          thermalCharsPerLine58: oldSettings?.thermalCharsPerLine58 ?? 24,
          thermalCharsPerLine80: oldSettings?.thermalCharsPerLine80 ?? 32,
          thermalShowLogo: oldSettings?.thermalShowLogo ?? false,
          thermalLogo: oldSettings?.thermalLogo || '',
        },
      })
    })

    return NextResponse.json({ success: true, message: 'All data cleared' })
  } catch (error) {
    console.error('Error resetting data:', error)
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 })
  }
}
