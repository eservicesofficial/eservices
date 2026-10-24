import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// Helper: Generate sequential ID using IdCounter
async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(4, '0')}`
}

// POST: Checkout customer — creates permanent CheckoutRecord snapshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'checkout')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // ── VALIDATION (FIRST CHECK): Block checkout when no transactions exist across ALL folios ──
    const anyEntriesExist = await db.ledgerEntry.count({
      where: { customerId: id },
    })
    if (anyEntriesExist === 0) {
      return NextResponse.json(
        { error: 'Cannot checkout this folio because no transactions or charges exist.' },
        { status: 400 }
      )
    }

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          include: {
            ledgerEntries: {
              where: { status: 'Active' },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        settlements: { orderBy: { createdAt: 'desc' } },
        visits: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const activeFolios = customer.folios.filter(f => f.status === 'Active')
    if (activeFolios.length === 0) {
      return NextResponse.json({ error: 'No active folios found' }, { status: 400 })
    }

    // ── VALIDATION: Prevent empty checkout ──
    const allEntries = activeFolios
      .flatMap(f => f.ledgerEntries)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    if (allEntries.length === 0) {
      return NextResponse.json(
        { error: 'Cannot checkout this folio because no transactions or charges exist.' },
        { status: 400 }
      )
    }

    // Verify UNIFIED balance across all folios
    let unifiedBalance = customer.openingBalance ?? 0
    for (const e of allEntries) {
      unifiedBalance = unifiedBalance + (e.debit || 0) - (e.credit || 0)
    }
    if (unifiedBalance > 0) {
      return NextResponse.json(
        { error: `Cannot checkout. Customer has an outstanding balance of ₹${unifiedBalance.toLocaleString('en-IN')}. Settle first.` },
        { status: 400 }
      )
    }

    // Parse optional body
    let notes = ''
    let preGeneratedInvoiceNo = ''
    try { const body = await request.json(); notes = body?.notes || ''; preGeneratedInvoiceNo = body?.invoiceNumber || '' } catch { /* empty body is fine */ }

    // ── Generate checkout number BEFORE transaction ──
    const checkoutNumber = await generateId('CO')
    const invoiceNumber = preGeneratedInvoiceNo || await generateId('INV')

    // ── Compute financial snapshot ──
    const totalCharges = allEntries.reduce((s, e) => s + e.debit, 0)
    const totalPayments = allEntries.reduce((s, e) => s + e.credit, 0)
    const totalTax = allEntries.reduce((s, e) => s + e.tax, 0)
    const totalDiscount = allEntries.reduce((s, e) => s + e.discount, 0)
    const totalRefunds = allEntries.filter(e => e.type === 'Refund').reduce((s, e) => s + e.debit, 0)

    // Only count settlements created AFTER the last checkout date
    const lastCheckout = await db.checkoutRecord.findFirst({
      where: { customerId: id },
      orderBy: { checkoutDate: 'desc' },
      select: { checkoutDate: true },
    })
    const relevantSettlements = lastCheckout
      ? customer.settlements.filter(s => s.createdAt > lastCheckout.checkoutDate)
      : customer.settlements
    const totalSettlements = relevantSettlements.reduce((s, s2) => s + s2.amount, 0)

    // Payment mode breakdown
    const paymentBreakdown: Record<string, number> = {}
    for (const e of allEntries) {
      if (e.type === 'Payment' && e.paymentMode) {
        paymentBreakdown[e.paymentMode] = (paymentBreakdown[e.paymentMode] || 0) + e.credit
      }
    }
    for (const s of relevantSettlements) {
      if (s.mode) {
        paymentBreakdown[s.mode] = (paymentBreakdown[s.mode] || 0) + s.amount
      }
    }

    // Transaction snapshot — only essential fields
    const transactionSnapshot = allEntries.map(e => ({
      id: e.id,
      date: e.date,
      docNo: e.docNo,
      invoiceNo: e.invoiceNo,
      type: e.type,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      tax: e.tax,
      discount: e.discount,
      balance: e.balance,
      paymentMode: e.paymentMode,
      userName: e.userName,
      status: e.status,
      folioId: e.folioId,
      createdAt: e.createdAt,
    }))

    // Settlements snapshot
    const settlementSnapshot = relevantSettlements.map(s => ({
      id: s.id,
      amount: s.amount,
      mode: s.mode,
      reference: s.reference,
      description: s.description,
      userName: s.userName,
      createdAt: s.createdAt,
    }))

    const latestVisit = customer.visits[0]

    // Process checkout in a transaction
    const result = await db.$transaction(async (tx) => {
      // Lock and archive ALL active folios
      for (const folio of activeFolios) {
        await tx.folio.update({
          where: { id: folio.id },
          data: {
            status: 'Archived',
            lockedAt: new Date(),
            lockedBy: session.userId,
          },
        })
      }

      // Update customer status
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: { status: 'CheckedOut' },
      })

      // Close any open visits
      await tx.customerVisit.updateMany({
        where: { customerId: id, checkOutAt: null },
        data: { checkOutAt: new Date() },
      })

      // Create permanent CheckoutRecord
      const checkoutRecord = await tx.checkoutRecord.create({
        data: {
          unitCode: session.unitCode,
          customerId: id,
          checkoutNumber,
          invoiceNumber,
          checkoutDate: new Date(),
          checkoutUser: session.name,
          checkoutUserId: session.userId,
          remarks: notes,
          // Customer snapshot
          customerName: customer.fullName,
          customerMobile: customer.mobile,
          customerEmail: customer.email,
          customerAddress: customer.address || '',
          customerType: customer.customerType,
          customerIdRef: customer.customerId,
          customerGstNumber: customer.gstNumber || '',
          customerGstAddress: customer.gstAddress || '',
          customerPanNumber: customer.panNumber || '',
          customerCompanyName: customer.companyName || '',
          // Folio info
          folioIds: JSON.stringify(activeFolios.map(f => f.id)),
          folioNumbers: JSON.stringify(activeFolios.map(f => f.folioNumber)),
          visitNumber: latestVisit?.visitNumber || 1,
          // Financials
          totalCharges,
          totalPayments,
          totalTax,
          totalDiscount,
          totalSettlements,
          totalRefunds,
          openingBalance: customer.openingBalance ?? 0,
          closingBalance: unifiedBalance,
          outstanding: Math.max(0, unifiedBalance),
          // Snapshots
          transactions: JSON.stringify(transactionSnapshot),
          settlements: JSON.stringify(settlementSnapshot),
          paymentBreakdown: JSON.stringify(paymentBreakdown),
        },
      })

      return { updatedCustomer, checkoutRecord }
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
        checkoutNumber,
        invoiceNumber,
        foliosLocked: activeFolios.map(f => f.folioId),
        entryCount: allEntries.length,
        totalCharges,
        totalPayments,
        closingBalance: unifiedBalance,
        notes,
      },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: activeFolios[0].id,
        action: 'Checkout',
        target: 'Customer',
        details: JSON.stringify({
          checkoutNumber,
          invoiceNumber,
          foliosLocked: activeFolios.map(f => f.folioId),
          customerName: customer.fullName,
          entryCount: allEntries.length,
          totalCharges,
          totalPayments,
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
      checkoutRecord: result.checkoutRecord,
      message: 'Customer checked out successfully',
    })
  } catch (error) {
    console.error('Error checking out customer:', error)
    return NextResponse.json({ error: 'Failed to checkout customer' }, { status: 500 })
  }
}