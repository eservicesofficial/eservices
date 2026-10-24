import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const history = await db.calcHistory.findMany({
      where: { unitCode: session.unitCode },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching calculator history:', error)
    return NextResponse.json({ error: 'Failed to fetch calculator history' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const entry = await db.calcHistory.create({
      data: {
        expression: body.expression,
        result: body.result,
        unitCode: session.unitCode,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Error creating calc history entry:', error)
    return NextResponse.json({ error: 'Failed to create calc history entry' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CLEAR_CALC_HISTORY', '', {}, request)
    await db.calcHistory.deleteMany({ where: { unitCode: session.unitCode } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing calculator history:', error)
    return NextResponse.json({ error: 'Failed to clear calculator history' }, { status: 500 })
  }
}
