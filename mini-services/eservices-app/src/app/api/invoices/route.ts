import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoices = await db.invoice.findMany({
      where: { unitCode: session.unitCode },
      include: { invoiceItems: true, refunds: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'billing', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { invoiceItems, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, isCompleted: _isCompleted, invoiceItems: _invoiceItems2, ...invoiceData } = body

    if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
      return NextResponse.json({ error: 'Invoice must have at least one item' }, { status: 400 })
    }

    if (!invoiceData.invoiceNumber || !invoiceData.customerName) {
      return NextResponse.json({ error: 'Invoice number and customer name are required' }, { status: 400 })
    }

    // Check for duplicate invoice number within the same unit
    const existing = await db.invoice.findFirst({
      where: { invoiceNumber: invoiceData.invoiceNumber, unitCode: session.unitCode },
    })
    if (existing) {
      return NextResponse.json({ error: `Invoice number "${invoiceData.invoiceNumber}" already exists` }, { status: 409 })
    }

    // Use transaction: create invoice + deduct stock atomically
    const stockUpdates: { name: string; deducted: number; remaining: number }[] = []
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber: invoiceData.invoiceNumber,
          date: invoiceData.date || new Date().toISOString().split('T')[0],
          customerName: invoiceData.customerName || '',
          customerAddress: invoiceData.customerAddress || '',
          customerPhone: invoiceData.customerPhone || '',
          paymentMethod: invoiceData.paymentMethod || 'Cash',
          status: invoiceData.status || 'Pending',
          subtotal: parseFloat(invoiceData.subtotal) || 0,
          cgst: parseFloat(invoiceData.cgst) || 0,
          sgst: parseFloat(invoiceData.sgst) || 0,
          deliveryCharge: parseFloat(invoiceData.deliveryCharge) || 0,
          discountAmount: parseFloat(invoiceData.discountAmount) || 0,
          grandTotal: parseFloat(invoiceData.grandTotal) || 0,
          paidAmount: parseFloat(invoiceData.paidAmount) || 0,
          balanceAmount: parseFloat(invoiceData.balanceAmount) || 0,
          orderType: invoiceData.orderType || 'Dine-In',
          unitCode: session.unitCode,
          invoiceItems: {
            create: invoiceItems.map((item: { name: string; description: string; qty: number; rate: number; total: number; itemId?: string }) => ({
              itemId: item.itemId || '',
              name: item.name,
              description: item.description || '',
              qty: parseInt(String(item.qty)) || 0,
              rate: parseFloat(String(item.rate)) || 0,
              total: parseFloat(String(item.total)) || 0,
            })),
          },
        },
        include: { invoiceItems: true },
      })

      // Deduct stock for each item that has an itemId (tracked inventory item)
      for (const item of invoiceItems) {
        const itemQty = parseInt(String(item.qty)) || 0
        const itemId = item.itemId
        if (itemId && itemQty > 0) {
          // Find the item and verify it belongs to this unit
          const inventoryItem = await tx.item.findFirst({
            where: { id: itemId, unitCode: session.unitCode },
          })
          if (inventoryItem) {
            const newQty = Math.max(0, inventoryItem.quantity - itemQty)
            await tx.item.update({
              where: { id: itemId },
              data: { quantity: newQty },
            })
            stockUpdates.push({ name: inventoryItem.name, deducted: itemQty, remaining: newQty })
          } else {
            console.warn(`Stock deduction skipped: item ${itemId} not found in unit ${session.unitCode}`)
          }
        }
      }

      return inv
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_INVOICE', invoiceData.invoiceNumber, { invoiceId: invoice.id, amount: invoice.grandTotal, stockUpdates }, request)

    return NextResponse.json({ ...invoice, stockUpdates }, { status: 201 })
  } catch (error) {
    console.error('Error creating invoice:', error)
    const msg = error instanceof Error ? error.message : 'Failed to create invoice'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
