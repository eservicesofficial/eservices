import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// GET: Ledger entries for a customer's active folio with running balance
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

    // Verify customer exists
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { status: 'Active' },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const activeFolio = customer.folios[0]
    if (!activeFolio) {
      return NextResponse.json({ error: 'No active folio found for this customer' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: Record<string, unknown> = {
      folioId: activeFolio.id,
      customerId: id,
      status: 'Active',
    }
    if (type) {
      where.type = type
    }

    const [entries, total] = await Promise.all([
      db.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ledgerEntry.count({ where }),
    ])

    // Get summary
    const summary = await db.ledgerEntry.aggregate({
      where: { folioId: activeFolio.id, customerId: id, status: 'Active' },
      _sum: {
        debit: true,
        credit: true,
        tax: true,
        discount: true,
      },
    })

    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null

    return NextResponse.json({
      folioId: activeFolio.id,
      folioNumber: activeFolio.folioId,
      entries,
      summary: {
        totalDebit: summary._sum.debit || 0,
        totalCredit: summary._sum.credit || 0,
        totalTax: summary._sum.tax || 0,
        totalDiscount: summary._sum.discount || 0,
        currentBalance: lastEntry?.balance ?? customer.openingBalance ?? 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching ledger entries:', error)
    return NextResponse.json({ error: 'Failed to fetch ledger entries' }, { status: 500 })
  }
}

// POST: Add ledger entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify customer and get active folio
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: { where: { status: 'Active' } },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.status === 'Archived') {
      return NextResponse.json({ error: 'Cannot add entries to an archived customer' }, { status: 400 })
    }

    const activeFolio = customer.folios[0]
    if (!activeFolio) {
      return NextResponse.json({ error: 'No active folio found. Reopen the customer first.' }, { status: 400 })
    }

    const body = await request.json()
    const {
      type,
      description,
      amount,
      debit,
      credit,
      tax,
      discount,
      docNo,
      invoiceNo,
      date,
    } = body

    if (!type) {
      return NextResponse.json({ error: 'Entry type is required (Charge, Payment, Refund, Discount, etc.)' }, { status: 400 })
    }

    const validTypes = ['Charge', 'Payment', 'Refund', 'Discount', 'Settlement', 'Transfer', 'Opening']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid entry type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Convert 'amount' to debit/credit based on entry type
    // Charge: adds to customer's balance (debit)
    // Payment: reduces customer's balance (credit)
    // Refund: adds to customer's balance (debit — they get money back)
    // Discount: reduces customer's balance (credit — they pay less)
    let finalDebit = debit || 0
    let finalCredit = credit || 0
    if (amount && amount > 0) {
      switch (type) {
        case 'Charge':
        case 'Refund':
          finalDebit = amount
          finalCredit = 0
          break
        case 'Payment':
        case 'Discount':
        case 'Settlement':
          finalDebit = 0
          finalCredit = amount
          break
        default:
          finalDebit = amount
          break
      }
    }

    // Compute running balance in a transaction
    const result = await db.$transaction(async (tx) => {
      // Get last balance
      const lastEntry = await tx.ledgerEntry.findFirst({
        where: { folioId: activeFolio.id, status: 'Active' },
        orderBy: { createdAt: 'desc' },
      })

      let runningBalance = lastEntry?.balance ?? customer.openingBalance ?? 0

      // Debit increases balance (customer owes more), Credit decreases balance
      runningBalance = runningBalance + finalDebit - finalCredit

      const entry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: id,
          date: date || new Date().toISOString().split('T')[0],
          docNo: docNo || '',
          invoiceNo: invoiceNo || '',
          type,
          description: description || `${type} entry`,
          debit: finalDebit,
          credit: finalCredit,
          tax: tax || 0,
          discount: discount || 0,
          balance: runningBalance,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      return { entry, runningBalance }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ADD_LEDGER_ENTRY',
      customer.fullName,
      {
        customerId: customer.customerId,
        folioId: activeFolio.folioId,
        entryType: type,
        amount: amount || debit || credit,
        debit: finalDebit,
        credit: finalCredit,
        newBalance: result.runningBalance,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: activeFolio.id,
        action: type === 'Charge' ? 'Create' : type === 'Payment' ? 'Settlement' : type,
        target: 'LedgerEntry',
        details: JSON.stringify({
          entryId: result.entry.id,
          type,
          debit: finalDebit,
          credit: finalCredit,
          balance: result.runningBalance,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: getClientIp(request),
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json(result.entry, { status: 201 })
  } catch (error) {
    console.error('Error adding ledger entry:', error)
    return NextResponse.json({ error: 'Failed to add ledger entry' }, { status: 500 })
  }
}
