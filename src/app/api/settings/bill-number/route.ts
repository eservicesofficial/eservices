import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

/**
 * GET /api/settings/bill-number
 * Get the next bill number without incrementing the counter.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await db.settings.findUnique({ where: { unitCode: session.unitCode } })

    if (!settings || !settings.billAutoGenerate) {
      return NextResponse.json({ autoGenerate: false })
    }

    // Calculate the next number that would be used
    // If billCurrentNumber is 0 (never used), the next will be billStartNumber
    const nextNum = settings.billCurrentNumber === 0
      ? settings.billStartNumber
      : settings.billCurrentNumber + 1

    const nextNumber = `${settings.billPrefix}${String(nextNum).padStart(4, '0')}`

    return NextResponse.json({
      autoGenerate: true,
      nextNumber,
      prefix: settings.billPrefix,
      startNumber: settings.billStartNumber,
      currentNumber: settings.billCurrentNumber,
    })
  } catch (error) {
    console.error('Error fetching bill number:', error)
    return NextResponse.json({ error: 'Failed to fetch bill number' }, { status: 500 })
  }
}

/**
 * POST /api/settings/bill-number
 * Claim (increment) the next bill number atomically.
 * Uses a Prisma transaction to prevent duplicate numbers.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use a transaction to atomically increment the bill number
    const result = await db.$transaction(async (tx) => {
      const settings = await tx.settings.findUnique({
        where: { unitCode: session.unitCode },
      })

      if (!settings) {
        throw new Error('SETTINGS_NOT_FOUND')
      }

      if (!settings.billAutoGenerate) {
        throw new Error('AUTO_GENERATE_DISABLED')
      }

      // Determine the next number
      // If billCurrentNumber is 0 (never used), start from billStartNumber
      const nextNumber = settings.billCurrentNumber === 0
        ? settings.billStartNumber
        : settings.billCurrentNumber + 1

      // Atomically update the counter using the current value as a condition
      // This prevents race conditions: if another request already incremented
      // the counter past what we read, this update will fail
      const updated = await tx.settings.updateMany({
        where: {
          unitCode: session.unitCode,
          billCurrentNumber: settings.billCurrentNumber,
        },
        data: {
          billCurrentNumber: nextNumber,
        },
      })

      // If no rows were updated, another concurrent request beat us — retry
      if (updated.count === 0) {
        throw new Error('CONCURRENT_UPDATE_RETRY')
      }

      const billNumber = `${settings.billPrefix}${String(nextNumber).padStart(4, '0')}`

      return { billNumber, currentNumber: nextNumber }
    }, {
      maxWait: 5000,
      timeout: 10000,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    // Handle specific error cases
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message === 'SETTINGS_NOT_FOUND') {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    if (message === 'AUTO_GENERATE_DISABLED') {
      return NextResponse.json({ error: 'Auto bill numbering is disabled' }, { status: 400 })
    }

    if (message === 'CONCURRENT_UPDATE_RETRY') {
      return NextResponse.json(
        { error: 'Concurrent update detected, please retry' },
        { status: 409 }
      )
    }

    console.error('Error claiming bill number:', error)
    return NextResponse.json({ error: 'Failed to claim bill number' }, { status: 500 })
  }
}
