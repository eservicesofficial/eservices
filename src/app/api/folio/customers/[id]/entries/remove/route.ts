import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Remove (soft-delete) ledger entries by setting status to 'Cancelled'
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canDelete = sessionHasPermission(session, 'customerFolio', 'delete')
    const canRemove = (() => { try { const p = session.permissions || {}; return p?.customerFolio?.removeTransaction || false } catch { return false } })()
    const canForceEdit = (session.role === 'Admin' || session.role === 'SuperAdmin') || (() => { try { const p = session.permissions || {}; return p?.customerFolio?.forceEdit || false } catch { return false } })()
    if (!canDelete && !canRemove && !canForceEdit) {
      return NextResponse.json({ error: 'Access denied. Requires removeTransaction or forceEdit permission.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { entryIds } = body

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'Entry IDs are required' }, { status: 400 })
    }

    // Verify customer exists and belongs to unit
    const customer = await db.customer.findUnique({
      where: { id },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify all entries exist, are Active, and belong to this customer
    // Search by entry ID + customer — works regardless of folio
    const entriesToRemove = await db.ledgerEntry.findMany({
      where: {
        id: { in: entryIds },
        customerId: id,
        status: 'Active',
      },
    })

    if (entriesToRemove.length === 0) {
      return NextResponse.json({ error: 'Selected transactions not found. They may have been already transferred or removed.' }, { status: 400 })
    }

    // Check if some entries were not found
    if (entriesToRemove.length !== entryIds.length) {
      const foundIds = entriesToRemove.map(e => e.id)
      const missingIds = entryIds.filter((eid: string) => !foundIds.includes(eid))
      return NextResponse.json(
        { error: `${missingIds.length} entry/entries not found or not active: ${missingIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Group entries by folio for balance recalculation
    const affectedFolioIds = [...new Set(entriesToRemove.map(e => e.folioId))]

    // Process removal in a transaction
    const result = await db.$transaction(async (tx) => {
      // Soft-delete: set status to 'Cancelled'
      const removed = await tx.ledgerEntry.updateMany({
        where: {
          id: { in: entryIds },
          customerId: id,
          status: 'Active',
        },
        data: {
          status: 'Cancelled',
        },
      })

      // Recalculate running balances for each affected folio
      for (const folioId of affectedFolioIds) {
        const activeEntries = await tx.ledgerEntry.findMany({
          where: { folioId, status: 'Active' },
          orderBy: { createdAt: 'asc' },
        })

        // Start balance from customer's openingBalance
        const customerData = await tx.customer.findUnique({ where: { id }, select: { openingBalance: true } })
        let runningBalance = customerData?.openingBalance ?? 0
        for (const entry of activeEntries) {
          runningBalance = runningBalance + entry.debit - entry.credit
          await tx.ledgerEntry.update({
            where: { id: entry.id },
            data: { balance: runningBalance },
          })
        }
      }

      return { count: removed.count }
    })

    // Log removal to FolioAuditLog for each entry
    for (const entry of entriesToRemove) {
      await db.folioAuditLog.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          folioId: entry.folioId,
          action: 'Delete',
          target: 'LedgerEntry',
          details: JSON.stringify({
            entryId: entry.id,
            entryType: entry.type,
            description: entry.description,
            debit: entry.debit,
            credit: entry.credit,
            previousBalance: entry.balance,
          }),
          userId: session.userId,
          userName: session.name,
          ipAddress: getClientIp(request),
          device: request.headers.get('user-agent') || '',
        },
      })
    }

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'REMOVE_LEDGER_ENTRIES',
      customer.fullName,
      {
        customerId: customer.customerId,
        count: result.count,
        entryIds: entriesToRemove.map(e => e.id),
        affectedFolioIds,
      },
      request
    )

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `${result.count} entry/entries removed`,
    })
  } catch (error) {
    console.error('Error removing ledger entries:', error)
    return NextResponse.json({ error: 'Failed to remove ledger entries' }, { status: 500 })
  }
}
