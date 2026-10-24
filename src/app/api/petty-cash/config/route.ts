import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let config = await db.pettyCashConfig.findUnique({ where: { id: session.unitCode } })
    if (!config) {
      config = await db.pettyCashConfig.create({ data: { id: session.unitCode, amount: 0 } })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error fetching petty cash config:', error)
    return NextResponse.json({ error: 'Failed to fetch petty cash config' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'cashManager', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const config = await db.pettyCashConfig.upsert({
      where: { id: session.unitCode },
      update: { amount: body.amount },
      create: { id: session.unitCode, amount: body.amount },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_PETTY_CASH_CONFIG', '', { amount: body.amount }, request)

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error updating petty cash config:', error)
    return NextResponse.json({ error: 'Failed to update petty cash config' }, { status: 500 })
  }
}
