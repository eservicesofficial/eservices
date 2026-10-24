import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

// POST /api/invoices/[id]/pay — Record a partial or full payment
export async function POST(
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
    const { amount } = body

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be a positive number' }, { status: 400 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
    })

    if (!invoice || invoice.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Use atomic increment to prevent race conditions
    const updated = await db.invoice.update({
      where: { id },
      data: {
        paidAmount: { increment: parsedAmount },
        balanceAmount: { decrement: parsedAmount },
        status: invoice.grandTotal - (invoice.paidAmount || 0) - parsedAmount <= 0 ? 'Paid' : 'Balance',
        paymentMethod: body.paymentMethod || invoice.paymentMethod,
      },
    })

    // Recompute status based on the returned values
    if (updated.balanceAmount <= 0 && updated.status !== 'Paid') {
      await db.invoice.update({
        where: { id },
        data: { status: 'Paid', balanceAmount: 0 },
      })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'RECORD_PAYMENT', invoice.invoiceNumber, { invoiceId: id, amount: parsedAmount }, request)

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
