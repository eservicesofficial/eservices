import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [settings, categories, items, invoices, refunds, pettyCashTransactions, pettyCashConfig, khataProfiles, khataTransactions, staffProfiles, attendance, calcHistory] =
      await Promise.all([
        db.settings.findMany({ where: { unitCode: session.unitCode } }),
        db.category.findMany({ where: { unitCode: session.unitCode } }),
        db.item.findMany({ where: { unitCode: session.unitCode } }),
        db.invoice.findMany({ where: { unitCode: session.unitCode }, include: { invoiceItems: true } }),
        db.refund.findMany({ where: { unitCode: session.unitCode } }),
        db.pettyCashTransaction.findMany({ where: { unitCode: session.unitCode } }),
        db.pettyCashConfig.findMany({ where: { id: session.unitCode } }),
        db.khataProfile.findMany({ where: { unitCode: session.unitCode } }),
        db.khataTransaction.findMany({ where: { profile: { unitCode: session.unitCode } } }),
        db.staffProfile.findMany({ where: { unitCode: session.unitCode } }),
        db.attendance.findMany({ where: { profile: { unitCode: session.unitCode } } }),
        db.calcHistory.findMany({ where: { unitCode: session.unitCode } }),
      ])

    const data = {
      settings,
      categories,
      items,
      invoices,
      refunds,
      pettyCashTransactions,
      pettyCashConfig,
      khataProfiles,
      khataTransactions,
      staffProfiles,
      attendance,
      calcHistory,
      exportedAt: new Date().toISOString(),
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
