import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// DELETE: Remove a customer document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
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

    const { id, docId } = await params

    // Verify customer exists and belongs to unit
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify document exists and belongs to customer
    const document = await db.customerDocument.findUnique({
      where: { id: docId },
    })
    if (!document || document.customerId !== id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await db.customerDocument.delete({
      where: { id: docId },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'DELETE_CUSTOMER_DOCUMENT',
      customer.fullName,
      {
        customerId: customer.customerId,
        documentType: document.type,
        documentName: document.name,
      },
      request
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting customer document:', error)
    return NextResponse.json({ error: 'Failed to delete customer document' }, { status: 500 })
  }
}
