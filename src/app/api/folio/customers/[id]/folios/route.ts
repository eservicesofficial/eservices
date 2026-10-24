import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Create a new folio for a customer (multi-folio support)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify customer exists and belongs to unit
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.status === 'Archived') {
      return NextResponse.json({ error: 'Cannot create folio for an archived customer' }, { status: 400 })
    }

    // Calculate visit number and folio number
    // Folio numbers start at 1 (folio 0 is reserved as "Master Folio" concept)
    const visitNumber = customer.folios.length + 1
    const existingFolioNumbers = customer.folios.map(f => f.folioNumber).sort((a, b) => a - b)
    let folioNumber = 1
    for (let i = 1; i <= existingFolioNumbers.length + 1; i++) {
      if (!existingFolioNumbers.includes(i)) { folioNumber = i; break }
    }

    if (folioNumber > 9999999) {
      return NextResponse.json({ error: 'Maximum folio number reached (9999999)' }, { status: 400 })
    }

    // Generate globally unique folioId using a counter
    let counter = await db.idCounter.findUnique({ where: { prefix: 'FOLIO' } })
    if (!counter) {
      // Find the max existing folio number and start from there
      const maxFolio = await db.folio.findFirst({ orderBy: { createdAt: 'desc' }, select: { folioId: true } })
      let nextNum = 1
      if (maxFolio) {
        const match = maxFolio.folioId.match(/\d+$/)
        if (match) nextNum = parseInt(match[0], 10) + 1
      }
      counter = await db.idCounter.create({ data: { prefix: 'FOLIO', lastNumber: nextNum } })
    }
    const nextFolioNum = counter.lastNumber + 1
    const folioId = `FOLIO-${String(nextFolioNum).padStart(3, '0')}`
    await db.idCounter.update({ where: { prefix: 'FOLIO' }, data: { lastNumber: nextFolioNum } })

    // Create folio and visit record in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the new folio
      const folio = await tx.folio.create({
        data: {
          unitCode: session.unitCode,
          folioId,
          folioNumber,
          customerId: id,
          visitNumber,
          status: 'Active',
        },
      })

      // Create a CustomerVisit record
      const visit = await tx.customerVisit.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          visitNumber,
          checkInAt: new Date(),
          checkOutAt: null,
        },
      })

      return { folio, visit }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'CREATE_FOLIO',
      customer.fullName,
      {
        customerId: customer.customerId,
        folioId: result.folio.folioId,
        folioNumber,
        visitNumber,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: result.folio.id,
        action: 'Create',
        target: 'Folio',
        details: JSON.stringify({
          folioId: result.folio.folioId,
          visitNumber,
          customerName: customer.fullName,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json(result.folio, { status: 201 })
  } catch (error) {
    console.error('Error creating folio:', error)
    return NextResponse.json({ error: 'Failed to create folio' }, { status: 500 })
  }
}
