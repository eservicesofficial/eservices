import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const where: Record<string, unknown> = { unitCode: session.unitCode }
    if (startDate) where.date = { ...(where.date as Record<string, unknown>), gte: startDate }
    if (endDate) where.date = { ...(where.date as Record<string, unknown>), lte: endDate }

    const transactions = await db.pettyCashTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 500,
    })

    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

    const config = await db.pettyCashConfig.findUnique({ where: { id: session.unitCode } })
    const pettyCash = config?.amount || 0

    return NextResponse.json({
      pettyCash,
      totalIncome,
      totalExpense,
      balance: pettyCash + totalIncome - totalExpense,
      transactions: transactions.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        type: t.type,
        amount: t.amount,
      })),
    })
  } catch (error) {
    console.error('Error fetching cash reports:', error)
    return NextResponse.json({ error: 'Failed to fetch cash reports' }, { status: 500 })
  }
}
