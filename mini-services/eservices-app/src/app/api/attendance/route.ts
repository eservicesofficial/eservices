import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'staff', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()

    // Verify the staff profile belongs to this unit
    const staffProfile = await db.staffProfile.findUnique({ where: { id: body.profileId } })
    if (!staffProfile || staffProfile.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
    }

    const attendance = await db.attendance.upsert({
      where: {
        profileId_date: {
          profileId: body.profileId,
          date: body.date,
        },
      },
      update: { status: body.status },
      create: {
        profileId: body.profileId,
        date: body.date,
        status: body.status,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPSERT_ATTENDANCE', `${body.profileId} ${body.date}`, { status: body.status }, request)

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error upserting attendance:', error)
    return NextResponse.json({ error: 'Failed to upsert attendance' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')

    const where: Record<string, unknown> = { profile: { unitCode: session.unitCode } }
    if (profileId) where.profileId = profileId
    if (month && year) {
      const prefix = `${year}-${month.padStart(2, '0')}`
      where.date = { startsWith: prefix }
    } else if (year) {
      where.date = { startsWith: year }
    }

    const records = await db.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(records)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}
