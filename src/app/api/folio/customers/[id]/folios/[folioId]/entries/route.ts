import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Get all Active ledger entries for a specific folio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folioId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id, folioId } = await params

    // Verify customer exists and belongs to unit
    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify folio exists and belongs to this customer
    const folio = await db.folio.findUnique({
      where: { id: folioId },
    })

    if (!folio || folio.customerId !== id) {
      return NextResponse.json({ error: 'Folio not found or does not belong to this customer' }, { status: 404 })
    }

    // Get all Active ledger entries for this folio, ordered by createdAt ASC
    const entries = await db.ledgerEntry.findMany({
      where: {
        folioId,
        customerId: id,
        status: 'Active',
      },
      orderBy: { createdAt: 'asc' },
    })

    // Compute summary totals
    const summary = await db.ledgerEntry.aggregate({
      where: {
        folioId,
        customerId: id,
        status: 'Active',
      },
      _sum: {
        debit: true,
        credit: true,
        tax: true,
      },
    })

    // Current balance = last entry's running balance
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null

    return NextResponse.json({
      folioId: folio.id,
      folioNumber: folio.folioId,
      visitNumber: folio.visitNumber,
      folioStatus: folio.status,
      entries,
      summary: {
        totalDebit: summary._sum.debit || 0,
        totalCredit: summary._sum.credit || 0,
        totalTax: summary._sum.tax || 0,
        currentBalance: lastEntry?.balance ?? 0,
        entryCount: entries.length,
      },
    })
  } catch (error) {
    console.error('Error fetching folio entries:', error)
    return NextResponse.json({ error: 'Failed to fetch folio entries' }, { status: 500 })
  }
}
