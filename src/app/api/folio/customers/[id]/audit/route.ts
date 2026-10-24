import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Get audit trail for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100') || 100, 500)
    const action = searchParams.get('action')

    const where: Record<string, unknown> = {
      customerId: id,
      unitCode: session.unitCode,
    }
    if (action) {
      where.action = action
    }

    const [auditLogs, total] = await Promise.all([
      db.folioAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.folioAuditLog.count({ where }),
    ])

    // Also fetch from main AuditLog for this customer
    const mainAuditLogs = await db.auditLog.findMany({
      where: {
        unitCode: session.unitCode,
        target: customer.customerId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Combine and deduplicate by time
    const combinedLogs = [
      ...auditLogs.map(log => ({
        id: log.id,
        source: 'folio',
        action: log.action,
        target: log.target,
        details: log.details,
        userId: log.userId,
        userName: log.userName,
        ipAddress: log.ipAddress,
        device: log.device,
        createdAt: log.createdAt,
      })),
      ...mainAuditLogs.map(log => ({
        id: log.id,
        source: 'audit',
        action: log.action,
        target: log.target,
        details: log.details,
        userId: log.userId,
        userName: log.userName,
        ipAddress: log.ipAddress,
        device: '',
        createdAt: log.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return NextResponse.json({
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
      },
      auditTrail: combinedLogs,
      pagination: {
        page,
        limit,
        totalFolioLogs: total,
      },
    })
  } catch (error) {
    console.error('Error fetching customer audit trail:', error)
    return NextResponse.json({ error: 'Failed to fetch audit trail' }, { status: 500 })
  }
}
