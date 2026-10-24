import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const refunds = await db.refund.findMany({
      where: { unitCode: session.unitCode },
      include: { originalInvoice: { include: { invoiceItems: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(refunds)
  } catch (error) {
    console.error('Error fetching refunds:', error)
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
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
    const { originalInvoiceId, items, refundAmount, reason } = body

    if (!originalInvoiceId || !refundAmount) {
      return NextResponse.json({ error: 'Invoice ID and refund amount are required' }, { status: 400 })
    }

    const parsedAmount = parseFloat(refundAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Refund amount must be a positive number' }, { status: 400 })
    }

    // Fetch the original invoice with its items to check if full refund
    const invoice = await db.invoice.findUnique({
      where: { id: originalInvoiceId },
      include: { invoiceItems: true },
    })

    if (!invoice || invoice.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Wrap entire refund flow in a transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // Generate refund number with collision retry
      let refundNumber = ''
      let attempts = 0
      const maxAttempts = 5
      while (attempts < maxAttempts) {
        const count = await tx.refund.count({ where: { unitCode: session.unitCode } })
        const candidate = `REF-${String(count + 1).padStart(4, '0')}`
        const exists = await tx.refund.findUnique({ where: { unitCode_refundNumber: { unitCode: session.unitCode, refundNumber: candidate } } })
        if (!exists) {
          refundNumber = candidate
          break
        }
        attempts++
      }
      if (!refundNumber) {
        refundNumber = `REF-${Date.now()}`
      }

      const refund = await tx.refund.create({
        data: {
          refundNumber,
          originalInvoiceId,
          date: new Date().toISOString().split('T')[0],
          items: JSON.stringify(items || []),
          refundAmount: parsedAmount,
          reason: reason || '',
          unitCode: session.unitCode,
        },
        include: { originalInvoice: true },
      })

      // Calculate total refunded amount for this invoice (sum of all refund records)
      const allRefunds = await tx.refund.findMany({
        where: { originalInvoiceId },
      })
      const totalRefunded = allRefunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0)

      // Compare against subtotal (items-only) since refunds are item-based.
      const subtotal = invoice.subtotal || 0
      const isFullyRefunded = totalRefunded >= subtotal

      let updatedInvoice
      if (isFullyRefunded) {
        // Full refund — mark invoice as "Refunded", zero out payment amounts,
        // and RESTORE stock for all invoice items
        for (const invItem of invoice.invoiceItems) {
          if (invItem.itemId && invItem.qty > 0) {
            const inventoryItem = await tx.item.findFirst({
              where: { id: invItem.itemId, unitCode: session.unitCode },
            })
            if (inventoryItem) {
              await tx.item.update({
                where: { id: invItem.itemId },
                data: { quantity: inventoryItem.quantity + invItem.qty },
              })
            }
          }
        }

        updatedInvoice = await tx.invoice.update({
          where: { id: originalInvoiceId },
          data: {
            status: 'Refunded',
            paidAmount: 0,
            balanceAmount: 0,
          },
        })
      } else {
        // Partial refund — restore stock for refunded items only
        // The `items` array contains which items are being refunded with their quantities
        const refundedItems: Array<{ name?: string; qty?: number; itemId?: string }> = Array.isArray(items) ? items : []
        for (const ri of refundedItems) {
          // Find the matching invoice item to get itemId (prefer itemId match over name match)
          const matchingInvItem = ri.itemId
            ? invoice.invoiceItems.find(ii => ii.itemId === ri.itemId)
            : invoice.invoiceItems.find(ii => ii.name === ri.name)
          const itemId = ri.itemId || matchingInvItem?.itemId
          const qty = ri.qty || matchingInvItem?.qty || 0
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

        // Keep original status, adjust paid/balance amounts
        const newPaid = Math.max(0, (invoice.paidAmount || 0) - parsedAmount)
        const remainingTotal = Math.max(0, invoice.grandTotal - totalRefunded)
        const newBalance = Math.max(0, remainingTotal - newPaid)
        updatedInvoice = await tx.invoice.update({
          where: { id: originalInvoiceId },
          data: {
            paidAmount: newPaid,
            balanceAmount: newBalance,
          },
        })
      }

      return { refund, updatedInvoice }
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_REFUND', result.refund.refundNumber, { invoiceId: originalInvoiceId, amount: parsedAmount }, request)

    return NextResponse.json({ ...result.refund, updatedInvoice: result.updatedInvoice }, { status: 201 })
  } catch (error) {
    console.error('Error creating refund:', error)
    return NextResponse.json({ error: 'Failed to create refund' }, { status: 500 })
  }
}
