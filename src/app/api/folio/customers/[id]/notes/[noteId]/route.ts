import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// PUT: Update a customer note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const canEdit =
      session.role === 'Admin' || session.role === 'SuperAdmin' ||
      sessionHasPermission(session, 'customerFolio', 'edit')

    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id, noteId } = await params
    const body = await request.json()

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const note = await db.customerNote.findUnique({ where: { id: noteId } })
    if (!note || note.customerId !== id) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.content !== undefined) updateData.content = String(body.content).trim()
    if (body.type !== undefined) updateData.type = body.type
    if (body.isPrivate !== undefined) updateData.isPrivate = Boolean(body.isPrivate)
    if (body.isImportant !== undefined) updateData.isImportant = Boolean(body.isImportant)

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await db.customerNote.update({
      where: { id: noteId },
      data: updateData,
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'UPDATE_CUSTOMER_NOTE',
      customer.fullName,
      { customerId: customer.customerId, noteId, changes: updateData },
      request
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating customer note:', error)
    return NextResponse.json({ error: 'Failed to update customer note' }, { status: 500 })
  }
}

// DELETE: Delete a customer note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions: Admin OR customerFolio.deleteDocuments OR customerFolio.delete
    const canDelete =
      session.role === 'Admin' ||
      sessionHasPermission(session, 'customerFolio', 'deleteDocuments') ||
      sessionHasPermission(session, 'customerFolio', 'delete')

    if (!canDelete) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id, noteId } = await params

    // Verify customer exists and belongs to unit
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
