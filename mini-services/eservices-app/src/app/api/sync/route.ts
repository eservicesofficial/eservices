import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return counts of key entities for change detection
    const [invoiceCount, pettyCashCount, itemCount, userCount, auditCount] = await Promise.all([
      db.invoice.count({ where: { unitCode: session.unitCode } }),
      db.pettyCashTransaction.count({ where: { unitCode: session.unitCode } }),
      db.item.count({ where: { unitCode: session.unitCode } }),
      db.user.count({ where: { unitCode: session.unitCode } }),
      db.auditLog.count({ where: { unitCode: session.unitCode } }),
    ])

    // Get latest audit log timestamp for change detection
    const latestAudit = await db.auditLog.findFirst({
      where: { unitCode: session.unitCode },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    return NextResponse.json({
      counts: { invoices: invoiceCount, pettyCash: pettyCashCount, items: itemCount, users: userCount, audit: auditCount },
      lastChange: latestAudit?.createdAt?.toISOString() || null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Sync check error:', error)
    return NextResponse.json({ error: 'Sync check failed' }, { status: 500 })
  }
}
