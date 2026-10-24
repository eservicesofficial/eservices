import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profiles = await db.khataProfile.findMany({
      where: { unitCode: session.unitCode },
      include: {
        transactions: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const profilesWithBalance = profiles.map((profile) => {
      const lastTxn = profile.transactions[profile.transactions.length - 1]
      let balance: number
      if (lastTxn && lastTxn.balanceSnapshot != null && !isNaN(lastTxn.balanceSnapshot)) {
        balance = lastTxn.balanceSnapshot
      } else if (profile.openingBalance != null && !isNaN(profile.openingBalance)) {
        balance = profile.openingBalance
      } else {
        balance = 0
      }
      return { ...profile, balance }
    })

    return NextResponse.json(profilesWithBalance)
  } catch (error) {
    console.error('Error fetching khata profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch khata profiles' }, { status: 500 })
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
    const profile = await db.khataProfile.create({
      data: {
        name: body.name,
        phone: body.phone || '',
        type: body.type || 'Customer',
        openingBalance: body.openingBalance ?? 0,
        unitCode: session.unitCode,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_KHATA_PROFILE', body.name, { profileId: profile.id }, request)

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('Error creating khata profile:', error)
    return NextResponse.json({ error: 'Failed to create khata profile' }, { status: 500 })
  }
}
