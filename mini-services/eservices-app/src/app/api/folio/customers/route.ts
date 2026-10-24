import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// Helper: Generate sequential ID using IdCounter
async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(3, '0')}`
}

// GET: List all customers with optional filters
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const tag = searchParams.get('tag')
    const hasDue = searchParams.get('hasDue') === 'true'
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: Record<string, unknown> = { unitCode: session.unitCode }

    if (status) {
      where.status = status
    }
    if (type) {
      where.customerType = type
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { mobile: { contains: search } },
        { whatsapp: { contains: search } },
        { email: { contains: search } },
        { customerId: { contains: search } },
      ]
    }
    if (tag) {
      where.tags = { some: { tagName: tag } }
    }

    // Determine sort order
    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'oldest') orderBy = { createdAt: 'asc' }
    else if (sort === 'name-asc') orderBy = { fullName: 'asc' }
    else if (sort === 'name-desc') orderBy = { fullName: 'desc' }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        select: {
          id: true,
          unitCode: true,
          customerId: true,
          primaryFolioId: true,
          fullName: true,
          mobile: true,
          whatsapp: true,
          email: true,
          customerType: true,
          creditLimit: true,
          status: true,
          gstNumber: true,
          panNumber: true,
          openingBalance: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.customer.count({ where }),
    ])

    // Batch enrichment: fetch all related data in 4 queries instead of N+1
    const customerIds = customers.map(c => c.id)

    // 1. Get last ledger entry per customer (balance + date) — distinct + orderBy gets latest per group
    const lastLedgers = await db.ledgerEntry.findMany({
      where: { customerId: { in: customerIds }, status: 'Active' },
      distinct: ['customerId'],
      orderBy: { createdAt: 'desc' },
      select: { customerId: true, balance: true, createdAt: true },
    })
    const ledgerMap = new Map(lastLedgers.map(l => [l.customerId, l]))

    // 2. Get visit counts per customer
    const visitCounts = await db.customerVisit.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _count: { id: true },
    })
    const visitMap = new Map(visitCounts.map(v => [v.customerId, v._count.id]))

    // 3. Get settlement counts per customer
    const settlementCounts = await db.settlement.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _count: { id: true },
    })
    const settlementMap = new Map(settlementCounts.map(s => [s.customerId, s._count.id]))

    // 4. Get tags for all customers
    const allTags = await db.customerTagAssignment.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true, customerId: true, tagName: true },
    })
    const tagMap = new Map<string, typeof allTags>()
    for (const tag of allTags) {
      if (!tagMap.has(tag.customerId)) tagMap.set(tag.customerId, [])
      tagMap.get(tag.customerId)!.push(tag)
    }

    // Build enriched customers
    const enrichedCustomers = customers.map(customer => {
      const ledger = ledgerMap.get(customer.id)
      const balance = ledger?.balance ?? customer.openingBalance ?? 0
      const lastTxnDate = ledger?.createdAt?.toISOString() ?? null
      const totalVisits = visitMap.get(customer.id) ?? 0
      const totalSettlements = settlementMap.get(customer.id) ?? 0
      const tags = tagMap.get(customer.id) ?? []

      return {
        ...customer,
        balance,
        lastTxnDate,
        totalVisits,
        totalSettlements,
        tags,
      }
    })

    // Filter by hasDue (only customers with positive balance)
    const filtered = hasDue
      ? enrichedCustomers.filter(c => c.balance > 0)
      : enrichedCustomers

    return NextResponse.json({
      customers: filtered,
      pagination: {
        page,
        limit,
        total: hasDue ? filtered.length : total,
        totalPages: Math.ceil((hasDue ? filtered.length : total) / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}

// POST: Create new customer with duplicate prevention
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const {
      fullName,
      mobile,
      whatsapp,
      email,
      customerType,
      creditLimit,
      internalNotes,
      gstNumber,
      panNumber,
      aadhaarNumber,
      openingBalance,
    } = body

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    // Duplicate prevention: Check across all customers in the unit
    const duplicateChecks: { field: string; value: string }[] = []
    if (mobile?.trim()) duplicateChecks.push({ field: 'mobile', value: mobile.trim() })
    if (email?.trim()) duplicateChecks.push({ field: 'email', value: email.trim() })
    if (gstNumber?.trim()) duplicateChecks.push({ field: 'gstNumber', value: gstNumber.trim() })
    if (panNumber?.trim()) duplicateChecks.push({ field: 'panNumber', value: panNumber.trim() })
    if (aadhaarNumber?.trim()) duplicateChecks.push({ field: 'aadhaarNumber', value: aadhaarNumber.trim() })

    for (const check of duplicateChecks) {
      const existing = await db.customer.findFirst({
        where: {
          unitCode: session.unitCode,
          [check.field]: check.value,
          status: { not: 'Archived' },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: `A customer with this ${check.field.replace(/([A-Z])/g, ' $1').toLowerCase()} already exists: ${existing.fullName} (${existing.customerId})` },
          { status: 409 }
        )
      }
    }

    // Generate IDs in a transaction
    const result = await db.$transaction(async (tx) => {
      const customerId = await generateId('CUST')
      const folioId = await generateId('FOLIO')

      // Create the customer
      const customer = await tx.customer.create({
        data: {
          unitCode: session.unitCode,
          customerId,
          primaryFolioId: folioId,
          fullName: fullName.trim(),
          mobile: mobile?.trim() || '',
          whatsapp: whatsapp?.trim() || mobile?.trim() || '',
          email: email?.trim() || '',
          customerType: customerType || 'Retail',
          creditLimit: creditLimit ?? 0,
          internalNotes: internalNotes || '',
          status: 'Active',
          gstNumber: gstNumber?.trim() || '',
          panNumber: panNumber?.trim() || '',
          aadhaarNumber: aadhaarNumber?.trim() || '',
          openingBalance: openingBalance ?? 0,
        },
      })

      // Create initial Folio
      const folio = await tx.folio.create({
        data: {
          unitCode: session.unitCode,
          folioId,
          customerId: customer.id,
          visitNumber: 1,
          status: 'Active',
        },
      })

      // Create initial Visit
      await tx.customerVisit.create({
        data: {
          unitCode: session.unitCode,
          customerId: customer.id,
          visitNumber: 1,
          checkInAt: new Date(),
        },
      })

      // If opening balance > 0, create opening ledger entry
      if (openingBalance && openingBalance > 0) {
        await tx.ledgerEntry.create({
          data: {
            unitCode: session.unitCode,
            folioId: folio.id,
            customerId: customer.id,
            date: new Date().toISOString().split('T')[0],
            type: 'Opening',
            description: 'Opening Balance',
            debit: openingBalance,
            credit: 0,
            balance: openingBalance,
            userId: session.userId,
            userName: session.name,
            status: 'Active',
          },
        })
      }

      return { customer, folio }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'CREATE_CUSTOMER',
      result.customer.fullName,
      {
        customerId: result.customer.customerId,
        customerType: result.customer.customerType,
        openingBalance: result.customer.openingBalance,
      },
      request
    )

    // Log to FolioAuditLog
    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: result.customer.id,
        folioId: result.folio.id,
        action: 'Create',
        target: 'Customer',
        details: JSON.stringify({
          customerId: result.customer.customerId,
          fullName: result.customer.fullName,
          openingBalance: result.customer.openingBalance,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json(result.customer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}
