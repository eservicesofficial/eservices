import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction } from '@/lib/auth'

// DELETE: Delete a customer note (only if user is admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Admin can delete notes
    if (session.role !== 'Admin') {
      return NextResponse.json({ error: 'Only Admin can delete notes' }, { status: 403 })
    }

    const { id, noteId } = await params

    // Verify customer exists
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify note exists and belongs to customer
    const note = await db.customerNote.findUnique({
      where: { id: noteId },
    })
    if (!note || note.customerId !== id) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    await db.customerNote.delete({
      where: { id: noteId },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'DELETE_CUSTOMER_NOTE',
      customer.fullName,
      {
        customerId: customer.customerId,
        noteType: note.type,
        noteId: noteId,
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer note:', error)
    return NextResponse.json({ error: 'Failed to delete customer note' }, { status: 500 })
  }
}
