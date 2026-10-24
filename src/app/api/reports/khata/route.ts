import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profiles = await db.khataProfile.findMany({
      where: { unitCode: session.unitCode },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const profilesWithBalance = profiles.map((p) => {
      // Use balanceSnapshot from last transaction for accurate cumulative balance
      const lastTxn = p.transactions[0]
      const balance = lastTxn?.balanceSnapshot ?? p.openingBalance ?? 0

      return {
        id: p.id,
        name: p.name,
        type: p.type === 'Customer' ? 'receivable' as const : 'payable' as const,
        balance: Math.abs(balance),
      }
    })

    const totalReceivable = profilesWithBalance
      .filter((p) => p.type === 'receivable')
      .reduce((sum, p) => sum + p.balance, 0)

    const totalPayable = profilesWithBalance
      .filter((p) => p.type === 'payable')
      .reduce((sum, p) => sum + p.balance, 0)

    return NextResponse.json({
      totalReceivable,
      totalPayable,
      netPosition: totalReceivable - totalPayable,
      profiles: profilesWithBalance,
    })
  } catch (error) {
    console.error('Error fetching khata reports:', error)
    return NextResponse.json({ error: 'Failed to fetch khata reports' }, { status: 500 })
  }
}
