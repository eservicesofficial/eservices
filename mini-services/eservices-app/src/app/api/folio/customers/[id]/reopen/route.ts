import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction } from '@/lib/auth'

// Helper: Generate sequential ID using IdCounter
async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(3, '0')}`
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Admin only. Reopen a settled/checked-out customer.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin only
    if (session.role !== 'Admin' && session.role !== 'SuperAdmin') {
      return NextResponse.json({ error: 'Only Admin can reopen customers' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: { orderBy: { createdAt: 'desc' }, take: 1 },
        visits: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.status === 'Active') {
      return NextResponse.json({ error: 'Customer is already active' }, { status: 400 })
    }

    // Parse optional body (frontend may send no body)
    let notes = ''
    let carryForwardBalance = true
    try { const body = await request.json(); notes = body?.notes || ''; carryForwardBalance = body?.carryForwardBalance ?? true } catch { /* empty body is fine */ }

    // Reopen in a transaction
    const result = await db.$transaction(async (tx) => {
      // Generate new folio ID
      const folioId = await generateId('FOLIO')

      // Get visit count for new visit number
      const visitCount = await tx.customerVisit.count({
        where: { customerId: id },
      })
      const newVisitNumber = visitCount + 1

      // Create new folio
      const newFolio = await tx.folio.create({
        data: {
          unitCode: session.unitCode,
          folioId,
          customerId: id,
          visitNumber: newVisitNumber,
          status: 'Active',
        },
      })

      // Create new visit record
      const newVisit = await tx.customerVisit.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          visitNumber: newVisitNumber,
          checkInAt: new Date(),
        },
      })

      // Update customer status and primary folio
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          status: 'Active',
          primaryFolioId: folioId,
        },
      })

      // If carry forward balance, get last balance and create opening entry
      let openingEntry: any = null
      if (carryForwardBalance) {
        const lastEntry = await tx.ledgerEntry.findFirst({
          where: { customerId: id, status: 'Active' },
          orderBy: { createdAt: 'desc' },
        })

        const lastBalance = lastEntry?.balance ?? customer.openingBalance ?? 0
        if (lastBalance > 0) {
          openingEntry = await tx.ledgerEntry.create({
            data: {
              unitCode: session.unitCode,
              folioId: newFolio.id,
              customerId: id,
              date: new Date().toISOString().split('T')[0],
              type: 'Opening',
              description: 'Balance carried forward from previous folio',
              debit: lastBalance,
              credit: 0,
              balance: lastBalance,
              userId: session.userId,
              userName: session.name,
              status: 'Active',
            },
          })
        }
      }

      return { updatedCustomer, newFolio, newVisit, openingEntry }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'REOPEN_CUSTOMER',
      customer.fullName,
      {
        customerId: customer.customerId,
        previousStatus: customer.status,
        newFolioId: result.newFolio.folioId,
        visitNumber: result.newVisit.visitNumber,
        carryForwardBalance,
        notes,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: result.newFolio.id,
        action: 'Reopen',
        target: 'Customer',
        details: JSON.stringify({
          previousStatus: customer.status,
          newFolioId: result.newFolio.folioId,
          visitNumber: result.newVisit.visitNumber,
          carryForwardBalance,
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
      newFolio: result.newFolio,
      newVisit: result.newVisit,
      openingEntry: result.openingEntry,
      message: 'Customer reopened successfully',
    })
  } catch (error) {
    console.error('Error reopening customer:', error)
    return NextResponse.json({ error: 'Failed to reopen customer' }, { status: 500 })
  }
}
