import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Get historical data - previous visits, old folios, old ledger entries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get all non-active (historical) folios with ledger entries
    const [oldFolios, visits, settlements, totalOldFolios] = await Promise.all([
      db.folio.findMany({
        where: {
          customerId: id,
          status: { not: 'Active' },
        },
        include: {
          ledgerEntries: {
            where: { status: 'Active' },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.customerVisit.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      }),
      db.settlement.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      }),
      db.folio.count({
        where: {
          customerId: id,
          status: { not: 'Active' },
        },
      }),
    ])

    // Compute per-folio summaries
    const folioSummaries = oldFolios.map(folio => {
      const entries = folio.ledgerEntries
      const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null

      return {
        id: folio.id,
        folioId: folio.folioId,
        visitNumber: folio.visitNumber,
        status: folio.status,
        lockedAt: folio.lockedAt,
        lockedBy: folio.lockedBy,
        settledAt: folio.settledAt,
        settledBy: folio.settledBy,
        createdAt: folio.createdAt,
        entryCount: entries.length,
        totalDebit: entries.reduce((sum, e) => sum + e.debit, 0),
        totalCredit: entries.reduce((sum, e) => sum + e.credit, 0),
        finalBalance: lastEntry?.balance ?? 0,
        ledgerEntries: entries,
      }
    })

    // Compute visit summaries
    const visitSummaries = visits.map(visit => ({
      id: visit.id,
      visitNumber: visit.visitNumber,
      checkInAt: visit.checkInAt,
      checkOutAt: visit.checkOutAt,
      duration: visit.checkOutAt
        ? Math.round((visit.checkOutAt.getTime() - visit.checkInAt.getTime()) / (1000 * 60))
        : null,
    }))

    return NextResponse.json({
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        status: customer.status,
      },
      historicalFolios: folioSummaries,
      visits: visitSummaries,
      settlements,
      pagination: {
        page,
        limit,
        total: totalOldFolios,
        totalPages: Math.ceil(totalOldFolios / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching customer history:', error)
    return NextResponse.json({ error: 'Failed to fetch customer history' }, { status: 500 })
  }
}
