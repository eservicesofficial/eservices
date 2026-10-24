import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [config, transactions] = await Promise.all([
      db.pettyCashConfig.upsert({
        where: { id: session.unitCode },
        update: {},
        create: { id: session.unitCode, amount: 0 },
      }),
      db.pettyCashTransaction.findMany({
        where: { unitCode: session.unitCode },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return NextResponse.json({ config, transactions })
  } catch (error) {
    console.error('Error fetching petty cash data:', error)
    return NextResponse.json({ error: 'Failed to fetch petty cash data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'cashManager', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const transaction = await db.pettyCashTransaction.create({
      data: {
        type: body.type,
        amount: body.amount,
        description: body.description,
        date: body.date,
        breakdown: body.breakdown ? JSON.stringify(body.breakdown) : '{}',
        unitCode: session.unitCode,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_PETTY_CASH_TXN', body.type, { amount: body.amount }, request)

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating petty cash transaction:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
