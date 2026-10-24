import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const staff = await db.staffProfile.findMany({
      where: { unitCode: session.unitCode },
      include: {
        attendance: { orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const staffWithStats = staff.map((member) => {
      const stats = {
        total: member.attendance.length,
        present: member.attendance.filter((a) => a.status === 'present').length,
        absent: member.attendance.filter((a) => a.status === 'absent').length,
        leave: member.attendance.filter((a) => a.status === 'leave').length,
        halfday: member.attendance.filter((a) => a.status === 'halfday').length,
        holiday: member.attendance.filter((a) => a.status === 'holiday').length,
      }
      return { ...member, stats }
    })

    return NextResponse.json(staffWithStats)
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'staff', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const member = await db.staffProfile.create({
      data: {
        name: body.name,
        designation: body.designation || '',
        department: body.department || '',
        dailyWageRate: body.dailyWageRate ?? 500,
        unitCode: session.unitCode,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_STAFF', body.name, { staffId: member.id }, request)

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Error creating staff profile:', error)
    return NextResponse.json({ error: 'Failed to create staff profile' }, { status: 500 })
  }
}
