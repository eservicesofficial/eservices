import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// GET: Customer detail with all relations and lifetime stats
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
          orderBy: { createdAt: 'desc' },
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        visits: { orderBy: { createdAt: 'desc' } },
        settlements: { orderBy: { createdAt: 'desc' } },
        tags: true,
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Find current active folio
    const activeFolio = customer.folios.find(f => f.status === 'Active')
    const activeLedger = activeFolio?.ledgerEntries || []

    // Compute lifetime stats — only from ACTIVE folio (not historical/archived)
    // The current balance reflects ALL active folios combined (unified running balance)
    const allActiveEntries = customer.folios
      .filter(f => f.status === 'Active')
      .flatMap(f => f.ledgerEntries)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    let unifiedBalance = customer.openingBalance ?? 0
    for (const e of allActiveEntries) {
      unifiedBalance = unifiedBalance + (e.debit || 0) - (e.credit || 0)
    }
    const lastActiveEntry = allActiveEntries.length > 0 ? allActiveEntries[allActiveEntries.length - 1] : null

    // For lifetime stats, aggregate across all folios
    const allLedgerEntries = customer.folios.flatMap(f => f.ledgerEntries)

    const totalDebit = allLedgerEntries.reduce((sum, e) => sum + e.debit, 0)
    const totalCredit = allLedgerEntries.reduce((sum, e) => sum + e.credit, 0)
    const totalTax = allLedgerEntries.reduce((sum, e) => sum + e.tax, 0)
    const totalDiscount = allLedgerEntries.reduce((sum, e) => sum + e.discount, 0)
    const totalSettlementAmount = customer.settlements.reduce((sum, s) => sum + s.amount, 0)
    const totalRefunds = allLedgerEntries
      .filter(e => e.type === 'Refund')
      .reduce((sum, e) => sum + e.debit, 0)

    const lifetimeStats = {
      totalVisits: customer.visits.length,
      totalSettlements: customer.settlements.length,
      totalCharges: totalDebit,
      totalPayments: totalCredit,
      totalTax: totalTax,
      totalDiscount: totalDiscount,
      totalSettlementAmount,
      totalRefunds,
      // Current balance = unified running balance across ALL active folios
      currentBalance: unifiedBalance,
      lastTransactionDate: lastActiveEntry?.createdAt?.toISOString() ?? null,
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        unitCode: customer.unitCode,
        customerId: customer.customerId,
        primaryFolioId: customer.primaryFolioId,
        fullName: customer.fullName,
        mobile: customer.mobile,
        whatsapp: customer.whatsapp,
        email: customer.email,
        address: customer.address || '',
        customerType: customer.customerType,
        creditLimit: customer.creditLimit,
        internalNotes: customer.internalNotes,
        status: customer.status,
        gstNumber: customer.gstNumber,
        gstAddress: customer.gstAddress || '',
        panNumber: customer.panNumber,
        aadhaarNumber: customer.aadhaarNumber,
        openingBalance: customer.openingBalance,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      activeFolio: activeFolio ? {
        id: activeFolio.id,
        folioId: activeFolio.folioId,
        folioNumber: activeFolio.folioNumber,
        status: activeFolio.status,
        visitNumber: activeFolio.visitNumber,
        ledgerEntries: activeLedger,
        lockedAt: activeFolio.lockedAt,
        lockedBy: activeFolio.lockedBy,
        settledAt: activeFolio.settledAt,
        settledBy: activeFolio.settledBy,
      } : null,
      folios: customer.folios.map(f => ({
        id: f.id,
        folioId: f.folioId,
        folioNumber: f.folioNumber,
        status: f.status,
        visitNumber: f.visitNumber,
        lockedAt: f.lockedAt,
        settledAt: f.settledAt,
        createdAt: f.createdAt,
      })),
      documents: customer.documents,
      notes: customer.notes.filter(n => !n.isPrivate || ['Admin', 'SuperAdmin'].includes(session.role)),
      visits: customer.visits,
      settlements: customer.settlements,
      tags: customer.tags.map(t => t.tagName),
      lifetimeStats,
    })
  } catch (error) {
    console.error('Error fetching customer detail:', error)
    return NextResponse.json({ error: 'Failed to fetch customer detail' }, { status: 500 })
  }
}

// PUT: Update customer profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify customer exists and belongs to unit
    const existing = await db.customer.findUnique({
      where: { id },
    })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Duplicate check for fields being changed
    const fieldsToCheck: { field: string; value: string }[] = []
    if (body.mobile && body.mobile !== existing.mobile) fieldsToCheck.push({ field: 'mobile', value: body.mobile.trim() })
    if (body.email && body.email !== existing.email) fieldsToCheck.push({ field: 'email', value: body.email.trim() })
    if (body.gstNumber && body.gstNumber !== existing.gstNumber) fieldsToCheck.push({ field: 'gstNumber', value: body.gstNumber.trim() })
    if (body.panNumber && body.panNumber !== existing.panNumber) fieldsToCheck.push({ field: 'panNumber', value: body.panNumber.trim() })
    if (body.aadhaarNumber && body.aadhaarNumber !== existing.aadhaarNumber) fieldsToCheck.push({ field: 'aadhaarNumber', value: body.aadhaarNumber.trim() })

    for (const check of fieldsToCheck) {
      const dup = await db.customer.findFirst({
        where: {
          unitCode: session.unitCode,
          id: { not: id },
          [check.field]: check.value,
          status: { not: 'Archived' },
        },
      })
      if (dup) {
        return NextResponse.json(
          { error: `Another customer with this ${check.field.replace(/([A-Z])/g, ' $1').toLowerCase()} already exists: ${dup.fullName} (${dup.customerId})` },
          { status: 409 }
        )
      }
    }

    // Track changes for audit
    const changes: Record<string, unknown> = {}
    const updatableFields = [
      'fullName', 'mobile', 'whatsapp', 'email', 'address', 'customerType',
      'creditLimit', 'internalNotes', 'gstNumber', 'gstAddress', 'panNumber', 'aadhaarNumber',
    ] as const

    const updateData: Record<string, unknown> = {}
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === 'string' ? (body[field] as string).trim() : body[field]
        if (body[field] !== (existing as Record<string, unknown>)[field]) {
          changes[field] = { from: (existing as Record<string, unknown>)[field], to: body[field] }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const customer = await db.customer.update({
      where: { id },
      data: updateData,
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'UPDATE_CUSTOMER',
      customer.fullName,
      { customerId: customer.customerId, changes },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: customer.id,
        action: 'Edit',
        target: 'Customer',
        details: JSON.stringify(changes),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

// DELETE: Archive or permanently delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Check for permanent delete flag
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    const existing = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          include: {
            ledgerEntries: { where: { status: 'Active' } },
          },
        },
      },
    })

    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Permanent delete: only Admin or SuperAdmin
    if (permanent) {
      if (session.role !== 'Admin' && !session.isSuperAdmin) {
        return NextResponse.json(
          { error: 'Only Admin or SuperAdmin can permanently delete customers' },
          { status: 403 }
        )
      }

      // Thorough balance check — compute running balance across ALL folios and ALL entries
      const allFolios = await db.folio.findMany({
        where: { customerId: id },
        include: { ledgerEntries: { orderBy: { createdAt: 'asc' } } },
      })

      let currentBalance = existing.openingBalance ?? 0
      for (const folio of allFolios) {
        for (const entry of folio.ledgerEntries) {
          if (entry.status !== 'Cancelled' && entry.status !== 'Reversed') {
            currentBalance = currentBalance + (entry.debit || 0) - (entry.credit || 0)
          }
        }
      }

      if (currentBalance > 0) {
        return NextResponse.json(
          { error: `Cannot permanently delete customer with outstanding balance of ₹${currentBalance.toFixed(2)}. Settle or transfer the balance first.` },
          { status: 400 }
        )
      }

      // Atomic cascade delete in a transaction
      await db.$transaction(async (tx) => {
        // FolioAuditLog has no FK relation — must delete explicitly
        await tx.folioAuditLog.deleteMany({ where: { customerId: id } })

        // Prisma onDelete: Cascade handles: Folio, LedgerEntry, CustomerDocument,
        // CustomerNote, CustomerTagAssignment, CustomerVisit, Settlement, CheckoutRecord
        await tx.customer.delete({ where: { id } })
      })

      await logAction(
        session.unitCode,
        session.userId,
        session.name,
        session.role,
        'PERMANENT_DELETE_CUSTOMER',
        existing.fullName,
        { customerId: existing.customerId },
        request
      )

      return NextResponse.json({ success: true, message: 'Customer permanently deleted' })
    }

    // Soft delete (archive) — check unified balance across ALL folios
    const activeFolio = existing.folios.find(f => f.status === 'Active')
    const allEntries = existing.folios
      .flatMap(f => f.ledgerEntries)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    let unifiedBalance = existing.openingBalance ?? 0
    for (const e of allEntries) {
      unifiedBalance = unifiedBalance + (e.debit || 0) - (e.credit || 0)
    }
    if (unifiedBalance > 0) {
      return NextResponse.json(
        { error: 'Cannot archive customer with outstanding balance. Settle or transfer the balance first.' },
        { status: 400 }
      )
    }

    // Archive the customer (soft delete)
    const customer = await db.customer.update({
      where: { id },
      data: { status: 'Archived' },
    })

    // Lock any active folios
    if (activeFolio) {
      await db.folio.update({
        where: { id: activeFolio.id },
        data: {
          status: 'Archived',
          lockedAt: new Date(),
          lockedBy: session.userId,
        },
      })
    }

    // Close any open visits
    await db.customerVisit.updateMany({
      where: {
        customerId: id,
        checkOutAt: null,
      },
      data: { checkOutAt: new Date() },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ARCHIVE_CUSTOMER',
      existing.fullName,
      { customerId: existing.customerId },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: customer.id,
        folioId: activeFolio?.id || '',
        action: 'Delete',
        target: 'Customer',
        details: JSON.stringify({ previousStatus: existing.status, customerName: existing.fullName }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json({ success: true, customer })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 })
  }
}
