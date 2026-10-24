import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// DELETE: Remove an empty folio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folioId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'customerFolio', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id, folioId } = await params

    // Verify customer
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        folios: {
          where: { id: folioId },
          include: {
            ledgerEntries: { where: { status: 'Active' } },
          },
        },
      },
    })

    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const folio = customer.folios[0]
    if (!folio) {
      return NextResponse.json({ error: 'Folio not found' }, { status: 404 })
    }

    // Cannot delete Master Folio (folioNumber 0)
    if (folio.folioNumber === 0) {
      return NextResponse.json({ error: 'Cannot delete Master Folio (Folio 0)' }, { status: 400 })
    }

    // Only allow deleting empty folios
    if (folio.ledgerEntries.length > 0) {
      return NextResponse.json({ error: 'Cannot delete folio with transactions. Remove all entries first.' }, { status: 400 })
    }

    // Delete the folio and associated visits
    await db.$transaction(async (tx) => {
      // Delete visits associated with this folio's visitNumber
      await tx.customerVisit.deleteMany({
        where: {
          customerId: id,
          visitNumber: folio.visitNumber,
        },
      })

      // Delete the folio
      await tx.folio.delete({
        where: { id: folioId },
      })
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'DELETE_FOLIO',
      customer.fullName,
      { customerId: customer.customerId, folioId: folio.folioId, folioNumber: folio.folioNumber },
      request
    )

    await db.folioAuditLog.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        folioId: folioId,
        action: 'Delete',
        target: 'Folio',
        details: JSON.stringify({
          folioId: folio.folioId,
          folioNumber: folio.folioNumber,
          visitNumber: folio.visitNumber,
        }),
        userId: session.userId,
        userName: session.name,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        device: request.headers.get('user-agent') || '',
      },
    })

    return NextResponse.json({ success: true, message: 'Folio deleted' })
  } catch (error) {
    console.error('Error deleting folio:', error)
    return NextResponse.json({ error: 'Failed to delete folio' }, { status: 500 })
  }
}