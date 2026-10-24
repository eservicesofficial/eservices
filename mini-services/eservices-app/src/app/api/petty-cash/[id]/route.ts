import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'cashManager', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const createdAt = searchParams.get('createdAt')

    if (!createdAt) {
      return NextResponse.json({ error: 'createdAt query param is required' }, { status: 400 })
    }

    // Verify transaction belongs to this unit by checking it exists first
    const existing = await db.pettyCashTransaction.findUnique({
      where: { id_createdAt: { id, createdAt: new Date(createdAt) } },
    })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_PETTY_CASH_TXN', id, { amount: existing.amount }, request)

    await db.pettyCashTransaction.delete({
      where: {
        id_createdAt: {
          id,
          createdAt: new Date(createdAt),
        },
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting petty cash transaction:', error)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }
}
