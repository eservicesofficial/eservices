import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(4, '0')}`
}

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

    if (!sessionHasPermission(session, 'customerFolio', 'access')) {
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
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

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

    if (!sessionHasPermission(session, 'customerFolio', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check forceEdit permission (allows editing checked-out folios)
    const canForceEdit = (session.role === 'Admin' || session.role === 'SuperAdmin') || (() => { try { const p = session.permissions || {}; return p?.customerFolio?.forceEdit || false } catch { return false } })()

    const { id } = await params

    // Parse body early to get optional folioId
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
      paymentMode,
      folioId: requestedFolioId,
    } = body

    // Verify customer
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: canForceEdit ? undefined : { where: { status: 'Active' } },
      },
    })

    // If forceEdit, re-fetch with all folios
    let allFolios: any[] = []
    if (canForceEdit && customer) {
      const customerWithFolios = await db.customer.findUnique({
        where: { id },
        include: { folios: true },
      })
      allFolios = customerWithFolios?.folios || []
    }

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    if (customer.status === 'Archived') {
      return NextResponse.json({ error: 'Cannot add entries to an archived customer' }, { status: 400 })
    }

    // Determine the target folio
    let activeFolio: any = null

    if (canForceEdit) {
      // Force edit mode: find the requested folio among ALL folios (not just active)
      const folioList = allFolios.length > 0 ? allFolios : (customer.folios || [])
      if (requestedFolioId) {
        activeFolio = folioList.find((f: any) => f.id === requestedFolioId)
      }
      // If no folio specified, use the most recent folio
      if (!activeFolio && folioList.length > 0) {
        const sorted = [...folioList].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        activeFolio = sorted[0]
      }
    } else {
      // Normal mode: only active folios
      const activeFolios = customer.folios || []
      activeFolio = activeFolios[0]
      if (requestedFolioId) {
        const matchingFolio = activeFolios.find((f: any) => f.id === requestedFolioId)
        if (matchingFolio) activeFolio = matchingFolio
      }
    }

    if (!activeFolio) {
      if (canForceEdit) {
        return NextResponse.json({ error: 'No folio found for this customer.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'No active folio found. Reopen the customer first.' }, { status: 400 })
    }

    // Body already parsed above
    // Destructured vars: type, description, amount, debit, credit, tax, discount, docNo, invoiceNo, date, paymentMode, requestedFolioId

    if (!type) {
      return NextResponse.json({ error: 'Entry type is required (Charge, Payment, Refund, Discount, etc.)' }, { status: 400 })
    }

    const validTypes = ['Charge', 'Payment', 'Refund', 'Discount', 'Settlement', 'Transfer', 'Opening']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid entry type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Convert 'amount' to debit/credit based on entry type
    // Debit = amount receivable from customer (customer owes money, balance goes UP)
    // Credit = amount paid by customer (balance goes DOWN)
    // Charge: customer owes us → Debit (balance UP)
    // Payment: customer pays us → Credit (balance DOWN)
    // Refund: customer overpaid (credit balance), we return money → Debit (balance UP toward 0)
    //   Refund is ONLY allowed when balance < 0 (credit/overpayment)
    // Discount: we reduce their bill → Credit (balance DOWN)
    // Settlement: customer settles → Credit (balance DOWN)
    let finalDebit = debit || 0
    let finalCredit = credit || 0
    if (amount && amount > 0) {
      switch (type) {
        case 'Charge':
          finalDebit = amount
          finalCredit = 0
          break
        case 'Refund':
          // Refund = Debit: returns money to customer, increases balance toward 0
          // Refund is ONLY valid when customer has a credit balance (balance < 0)
          // Validate: check overall balance across all folios
          {
            const allLastEntries = await db.ledgerEntry.findMany({
              where: { customerId: id, status: 'Active' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            })
            const overallBalance = allLastEntries[0]?.balance ?? customer.openingBalance ?? 0
            if (overallBalance >= 0) {
              return NextResponse.json({
                error: `Refund requires a credit balance. Current balance is ₹${overallBalance.toLocaleString('en-IN')}. Customer must have overpaid to process a refund.`,
              }, { status: 400 })
            }
            const maxRefund = Math.abs(overallBalance)
            if (amount > maxRefund) {
              return NextResponse.json({
                error: `Refund amount (₹${amount.toLocaleString('en-IN')}) exceeds available credit balance (₹${maxRefund.toLocaleString('en-IN')})`,
              }, { status: 400 })
            }
          }
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

    // Generate transaction number and optional invoice number
    const txnDocNo = docNo || await generateId('TXN')
    let finalInvoiceNo = invoiceNo || ''
    if (!finalInvoiceNo && type === 'Charge') {
      finalInvoiceNo = await generateId('INV')
    }
    // P5: Generate VOU-xxxx for Payment entries (permanent voucher number)
    if (!finalInvoiceNo && type === 'Payment') {
      finalInvoiceNo = await generateId('VOU')
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
          docNo: txnDocNo,
          invoiceNo: finalInvoiceNo,
          type,
          description: description || `${type} entry`,
          debit: finalDebit,
          credit: finalCredit,
          tax: tax || 0,
          discount: discount || 0,
          balance: runningBalance,
          paymentMode: paymentMode || '',
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
          forceEdit: canForceEdit && customer.status !== 'Active',
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
