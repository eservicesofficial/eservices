import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission } from '@/lib/auth'

// GET: Get checkout history — permanent checkout records
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
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Optional date range filter (YYYY-MM-DD format)
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    // Legacy single-date filter (backward compat)
    const dateFilter = searchParams.get('date')

    // Build where clause with optional date filter
    const whereClause: Record<string, unknown> = { customerId: id }
    if (dateFrom || dateTo) {
      const dateRange: Record<string, unknown> = {}
      if (dateFrom) dateRange.gte = new Date(dateFrom + 'T00:00:00.000Z')
      if (dateTo) dateRange.lte = new Date(dateTo + 'T23:59:59.999Z')
      whereClause.checkoutDate = dateRange
    } else if (dateFilter) {
      const startOfDay = new Date(dateFilter + 'T00:00:00.000Z')
      const endOfDay = new Date(dateFilter + 'T23:59:59.999Z')
      whereClause.checkoutDate = { gte: startOfDay, lte: endOfDay }
    }

    // Fetch checkout records for this customer, newest first
    const checkoutRecords = await db.checkoutRecord.findMany({
      where: whereClause,
      orderBy: { checkoutDate: 'desc' },
    })

    // Parse JSON fields for each record
    const records = checkoutRecords.map(r => ({
      id: r.id,
      checkoutNumber: r.checkoutNumber,
      invoiceNumber: r.invoiceNumber,
      customInvoiceNumber: r.customInvoiceNumber || '',
      checkoutDate: r.checkoutDate,
      checkoutUser: r.checkoutUser,
      checkoutUserId: r.checkoutUserId,
      remarks: r.remarks,
      // Customer snapshot
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      customerEmail: r.customerEmail,
      customerAddress: r.customerAddress,
      customerType: r.customerType,
      customerIdRef: r.customerIdRef,
      // Folio info
      folioIds: JSON.parse(r.folioIds || '[]'),
      folioNumbers: JSON.parse(r.folioNumbers || '[]'),
      visitNumber: r.visitNumber,
      // Financials
      totalCharges: r.totalCharges,
      totalPayments: r.totalPayments,
      totalTax: r.totalTax,
      totalDiscount: r.totalDiscount,
      totalSettlements: r.totalSettlements,
      totalRefunds: r.totalRefunds,
      openingBalance: r.openingBalance,
      closingBalance: r.closingBalance,
      outstanding: r.outstanding,
      // Parsed snapshots
      transactions: JSON.parse(r.transactions || '[]'),
      settlements: JSON.parse(r.settlements || '[]'),
      paymentBreakdown: JSON.parse(r.paymentBreakdown || '{}'),
    }))

    return NextResponse.json({
      customer: {
        id: customer.id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        status: customer.status,
      },
      checkoutRecords: records,
      totalRecords: records.length,
    })
  } catch (error) {
    console.error('Error fetching customer checkout history:', error)
    return NextResponse.json({ error: 'Failed to fetch checkout history' }, { status: 500 })
  }
}

// PATCH: Update custom invoice number for a checkout record
export async function PATCH(
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

    const { id: customerId } = await params
    const body = await request.json()
    const { checkoutRecordId, customInvoiceNumber } = body

    if (!checkoutRecordId || customInvoiceNumber === undefined) {
      return NextResponse.json({ error: 'Missing required fields: checkoutRecordId, customInvoiceNumber' }, { status: 400 })
    }

    // Verify the checkout record belongs to this customer
    const record = await db.checkoutRecord.findFirst({
      where: { id: checkoutRecordId, customerId, unitCode: session.unitCode },
    })

    if (!record) {
      return NextResponse.json({ error: 'Checkout record not found' }, { status: 404 })
    }

    const updated = await db.checkoutRecord.update({
      where: { id: checkoutRecordId },
      data: { customInvoiceNumber: String(customInvoiceNumber).trim() },
    })

    return NextResponse.json({ success: true, customInvoiceNumber: updated.customInvoiceNumber })
  } catch (error) {
    console.error('Error updating custom invoice number:', error)
    return NextResponse.json({ error: 'Failed to update invoice number' }, { status: 500 })
  }
}