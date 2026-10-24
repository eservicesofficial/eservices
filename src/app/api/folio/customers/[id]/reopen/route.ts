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

// POST: Admin or reopenFolio permission. Reopen a settled/checked-out customer.
// Creates a FRESH empty folio — no carried-forward transactions or balance.
// Original folio and all historical records remain permanently preserved.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check customerFolio.reopenFolio permission
    const isAdmin = session.role === 'Admin' || session.role === 'SuperAdmin'
    const hasReopenPerm = (() => {
      try {
        const perms = session.permissions || {}
        return perms?.customerFolio?.reopenFolio || perms?.customerFolio?.edit || false
      } catch { return false }
    })()
    if (!isAdmin && !hasReopenPerm) {
      return NextResponse.json({ error: 'Only Admin or authorized users can reopen customers' }, { status: 403 })
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

    // VALIDATION: Only CheckedOut or Settled customers can be reopened
    if (customer.status === 'Active') {
      return NextResponse.json({ error: 'Customer is already active. Cannot reopen.' }, { status: 400 })
    }
    if (customer.status === 'Archived') {
      return NextResponse.json({ error: 'Customer is archived. Unarchive first.' }, { status: 400 })
    }
    if (!['CheckedOut', 'Settled'].includes(customer.status)) {
      return NextResponse.json({ error: `Customer status '${customer.status}' cannot be reopened. Only CheckedOut or Settled customers can be reopened.` }, { status: 400 })
    }

    // VALIDATION: Ensure no active folio already exists
    const existingActive = await db.folio.findFirst({
      where: { customerId: id, status: 'Active' },
    })
    if (existingActive) {
      return NextResponse.json({
        error: 'Customer already has an active folio. Cannot create another.',
        existingFolioId: existingActive.folioId,
      }, { status: 400 })
    }

    // Generate folio ID BEFORE the transaction
    const folioId = await generateId('FOLIO')

    // Reopen in a transaction — creates a FRESH empty folio
    const result = await db.$transaction(async (tx) => {
      // Get visit count for new visit number
      const visitCount = await tx.customerVisit.count({
        where: { customerId: id },
      })
      const newVisitNumber = visitCount + 1

      // Get the next folio number for this customer
      const existingFolios = await tx.folio.findMany({
        where: { customerId: id },
        select: { folioNumber: true },
        orderBy: { folioNumber: 'desc' },
      })
      const nextFolioNumber = existingFolios.length > 0 ? Math.max(...existingFolios.map(f => f.folioNumber)) + 1 : 1
      const cappedFolioNumber = Math.min(nextFolioNumber, 9999999)

      // Create new FRESH folio (no transactions carried forward)
      const newFolio = await tx.folio.create({
        data: {
          unitCode: session.unitCode,
          folioId,
          customerId: id,
          folioNumber: cappedFolioNumber,
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

      // Update customer status to Active, reset opening balance to 0, set primary folio to the NEW folio
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          status: 'Active',
          primaryFolioId: folioId,
          openingBalance: 0,
        },
      })

      return { updatedCustomer, newFolio, newVisit }
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
        freshFolio: true,
        preservedHistory: true,
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
          freshFolio: true,
          noCarryForward: true,
          preservedFolios: customer.folios.map(f => f.folioId),
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
      message: 'Customer reopened with fresh folio successfully. All previous history preserved.',
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Error reopening customer:', msg, error)
    return NextResponse.json({ error: 'Failed to reopen customer. Please try again.' }, { status: 500 })
  }
}
