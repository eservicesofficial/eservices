import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Settlement overview across all folios — uses UNIFIED balance (same as Master Folio)
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

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
          orderBy: { folioNumber: 'asc' },
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // ── UNIFIED balance calculation (identical to Master Folio / statement API) ──
    // Start with opening balance, then add all entries chronologically
    const allEntries = customer.folios
      .flatMap(f => f.ledgerEntries.map(e => ({ ...e, folioId: f.id, folioNumber: f.folioNumber })))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    let unifiedRunningBalance = customer.openingBalance ?? 0
    const unifiedEntries = allEntries.map(e => {
      unifiedRunningBalance = unifiedRunningBalance + (e.debit || 0) - (e.credit || 0)
      return { ...e, unifiedBalance: unifiedRunningBalance }
    })

    const unifiedTotalDebits = allEntries.reduce((s, e) => s + (e.debit || 0), 0)
    const unifiedTotalCredits = allEntries.reduce((s, e) => s + (e.credit || 0), 0)
    const unifiedFinalBalance = unifiedEntries.length > 0
      ? unifiedEntries[unifiedEntries.length - 1].unifiedBalance
      : (customer.openingBalance ?? 0)

    // Total outstanding = positive part of unified balance (debt owed)
    const totalOutstanding = Math.max(0, unifiedFinalBalance)
    // Credit balance = negative part of unified balance (advance/overpayment)
    const creditBalance = Math.min(0, unifiedFinalBalance)

    // ── Per-folio breakdown (informational — shows individual folio standing) ──
    const folios = customer.folios.map(f => {
      const entries = f.ledgerEntries
      const totalDebits = entries.reduce((s, e) => s + (e.debit || 0), 0)
      const totalCredits = entries.reduce((s, e) => s + (e.credit || 0), 0)
      const outstandingBalance = entries.length > 0
        ? entries[entries.length - 1].balance
        : 0

      return {
        folioId: f.id,
        folioNumber: f.folioNumber,
        folioStatus: f.status,
        totalDebits,
        totalCredits,
        outstandingBalance,
        entryCount: entries.length,
        transactions: entries.slice(-50).map(e => ({
          id: e.id,
          date: e.date,
          type: e.type,
          description: e.description,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
        })),
      }
    })

    // ── Per-folio outstanding (what the settle API can actually distribute) ──
    const perFolioOutstanding = folios.reduce((s, f) => s + Math.max(0, f.outstandingBalance), 0)

    return NextResponse.json({
      customerId: customer.id,
      customerName: customer.fullName,
      totalOutstanding,
      perFolioOutstanding,
      creditBalance,
      openingBalance: customer.openingBalance ?? 0,
      unifiedTotalDebits,
      unifiedTotalCredits,
      unifiedFinalBalance,
      folios,
    })
  } catch (error) {
    console.error('Error fetching settlement overview:', error)
    return NextResponse.json({ error: 'Failed to fetch settlement overview' }, { status: 500 })
  }
}