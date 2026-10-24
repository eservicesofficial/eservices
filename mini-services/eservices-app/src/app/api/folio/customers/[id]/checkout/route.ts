import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Checkout customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const activeFolio = customer.folios[0]
    if (!activeFolio) {
      return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
    }

    // Verify no outstanding balance
    const currentBalance = activeFolio.ledgerEntries[0]?.balance ?? customer.openingBalance ?? 0
    if (currentBalance > 0) {
      return NextResponse.json(
        { error: `Cannot checkout customer with outstanding balance of ${currentBalance}. Settle first.` },
        { status: 400 }
      )
    }

    // Parse optional body (frontend may send no body)
    let notes = ''
    try { const body = await request.json(); notes = body?.notes || '' } catch { /* empty body is fine */ }

    // Process checkout in a transaction
    const result = await db.$transaction(async (tx) => {
      // Lock and archive the active folio
      await tx.folio.update({
        where: { id: activeFolio.id },
        data: {
          status: 'Archived',
          lockedAt: new Date(),
          lockedBy: session.userId,
        },
      })

      // Update customer status
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { status: 'CheckedOut' },
      })

      // Close any open visit
      const closedVisit = await tx.customerVisit.updateMany({
        where: { customerId: id, checkOutAt: null },
        data: { checkOutAt: new Date() },
      })

      return { updatedCustomer, closedVisit }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'CHECKOUT_CUSTOMER',
      customer.fullName,
      {
        customerId: customer.customerId,
        folioId: activeFolio.folioId,
        notes,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: activeFolio.id,
        action: 'Checkout',
        target: 'Folio',
        details: JSON.stringify({
          folioId: activeFolio.folioId,
          customerName: customer.fullName,
          notes,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json({
      success: true,
      customer: result.updatedCustomer,
      message: 'Customer checked out successfully',
    })
  } catch (error) {
    console.error('Error checking out customer:', error)
    return NextResponse.json({ error: 'Failed to checkout customer' }, { status: 500 })
  }
}
