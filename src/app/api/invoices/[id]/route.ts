import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { invoiceItems: true, refunds: true },
    })
    if (!invoice || invoice.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'billing', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { invoiceItems, refunds: _refunds, isCompleted: _isCompleted, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, unitCode: _unitCode, ...invoiceData } = body

    // Verify invoice belongs to this unit
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { invoiceItems: true },
    })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = await db.$transaction(async (tx) => {
      // If invoice items are being replaced, adjust stock accordingly
      if (Array.isArray(invoiceItems)) {
        // 1. Restore stock for OLD items (reverse the old deduction)
        for (const oldItem of existing.invoiceItems) {
          const oldQty = oldItem.qty
          const oldItemId = oldItem.itemId
          if (oldItemId && oldQty > 0) {
            const inventoryItem = await tx.item.findFirst({
              where: { id: oldItemId, unitCode: session.unitCode },
            })
            if (inventoryItem) {
              await tx.item.update({
                where: { id: oldItemId },
                data: { quantity: inventoryItem.quantity + oldQty },
              })
            }
          }
        }

        // 2. Delete old invoice items
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })

        // 3. Create new invoice items AND deduct stock for NEW items
        for (const item of invoiceItems) {
          const itemQty = parseInt(String(item.qty)) || 0
          const itemId = item.itemId

          // Deduct stock for new item
          if (itemId && itemQty > 0) {
            const inventoryItem = await tx.item.findFirst({
              where: { id: itemId, unitCode: session.unitCode },
            })
            if (inventoryItem) {
              const newQty = Math.max(0, inventoryItem.quantity - itemQty)
              await tx.item.update({
                where: { id: itemId },
                data: { quantity: newQty },
              })
            }
          }
        }
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...invoiceData,
          ...(Array.isArray(invoiceItems) && invoiceItems.length > 0
            ? {
                invoiceItems: {
                  create: invoiceItems.map((item: any) => ({
                    itemId: item.itemId || '',
                    name: String(item.name || ''),
                    description: String(item.description || ''),
                    qty: parseInt(String(item.qty)) || 0,
                    rate: parseFloat(String(item.rate)) || 0,
                    total: parseFloat(String(item.total)) || 0,
                  })),
                },
              }
            : {}),
        },
        include: { invoiceItems: true },
      })
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_INVOICE', existing.invoiceNumber, { invoiceId: id }, request)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'billing', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify invoice belongs to this unit and get items for stock restoration
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { invoiceItems: true },
    })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_INVOICE', existing.invoiceNumber, { invoiceId: id }, request)

    // Use transaction: restore stock + delete invoice atomically
    await db.$transaction(async (tx) => {
      // 1. Restore stock for each invoice item
      for (const invItem of existing.invoiceItems) {
        const itemId = invItem.itemId
        const qty = invItem.qty
        if (itemId && qty > 0) {
          const inventoryItem = await tx.item.findFirst({
            where: { id: itemId, unitCode: session.unitCode },
          })
          if (inventoryItem) {
            await tx.item.update({
              where: { id: itemId },
              data: { quantity: inventoryItem.quantity + qty },
            })
          }
        }
      }

      // 2. Delete refunds first (FK constraint), then invoice (cascade deletes invoiceItems)
      await tx.refund.deleteMany({ where: { originalInvoiceId: id } })
      await tx.invoice.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
