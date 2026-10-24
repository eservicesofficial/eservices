import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

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
    const profile = await db.khataProfile.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    })
    if (!profile || profile.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Compute balance from the last transaction's balanceSnapshot or openingBalance
    const lastTxn = profile.transactions[profile.transactions.length - 1]
    let balance: number
    if (lastTxn && lastTxn.balanceSnapshot != null && !isNaN(lastTxn.balanceSnapshot)) {
      balance = lastTxn.balanceSnapshot
    } else if (profile.openingBalance != null && !isNaN(profile.openingBalance)) {
      balance = profile.openingBalance
    } else {
      balance = 0
    }

    return NextResponse.json({ ...profile, balance })
  } catch (error) {
    console.error('Error fetching khata profile:', error)
    return NextResponse.json({ error: 'Failed to fetch khata profile' }, { status: 500 })
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

    if (!sessionHasPermission(session, 'khata', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify profile belongs to this unit
    const existing = await db.khataProfile.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profile = await db.khataProfile.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        type: body.type,
        openingBalance: body.openingBalance,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_KHATA_PROFILE', body.name, { profileId: id }, request)

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error updating khata profile:', error)
    return NextResponse.json({ error: 'Failed to update khata profile' }, { status: 500 })
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

    if (!sessionHasPermission(session, 'khata', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify profile belongs to this unit
    const existing = await db.khataProfile.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_KHATA_PROFILE', existing.name, { profileId: id }, request)
    await db.khataProfile.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting khata profile:', error)
    return NextResponse.json({ error: 'Failed to delete khata profile' }, { status: 500 })
  }
}
