import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const profileId = searchParams.get('profileId')

    const where: Record<string, unknown> = { profile: { unitCode: session.unitCode } }
    if (profileId) where.profileId = profileId

    const transactions = await db.khataTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        profile: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching khata transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch khata transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { profileId, type, amount, description, date } = body

    const profile = await db.khataProfile.findUnique({ where: { id: profileId } })
    if (!profile || profile.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const lastTxn = await db.khataTransaction.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    })
    let currentBalance: number
    if (lastTxn && lastTxn.balanceSnapshot != null && !isNaN(lastTxn.balanceSnapshot)) {
      currentBalance = lastTxn.balanceSnapshot
    } else if (profile.openingBalance != null && !isNaN(profile.openingBalance)) {
      currentBalance = profile.openingBalance
    } else {
      currentBalance = 0
    }

    let newBalance: number
    if (type === 'in') {
      newBalance = currentBalance + amount
    } else {
      newBalance = currentBalance - amount
    }

    const transaction = await db.khataTransaction.create({
      data: {
        profileId,
        date,
        type,
        amount,
        description: description || '',
        balanceSnapshot: newBalance,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_KHATA_TXN', `${type} ${amount}`, { profileId, amount }, request)

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating khata transaction:', error)
    return NextResponse.json({ error: 'Failed to create khata transaction' }, { status: 500 })
  }
}
