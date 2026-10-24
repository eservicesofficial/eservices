import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

// Helper: format a Date object as YYYY-MM-DD string in IST
function toISTDateString(date: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = toISTDateString(new Date())

    const staffProfiles = await db.staffProfile.findMany({
      where: { unitCode: session.unitCode },
      include: {
        attendance: {
          where: { date: today },
        },
      },
    })

    const staffList = staffProfiles.map((s) => {
      const todayAttendance = s.attendance[0]
      let status: 'present' | 'absent' | 'on-leave' = 'absent'
      if (todayAttendance) {
        if (todayAttendance.status === 'present') status = 'present'
        else if (todayAttendance.status === 'leave') status = 'on-leave'
        else if (todayAttendance.status === 'halfday') status = 'present'
      }
      return {
        id: s.id,
        name: s.name,
        designation: s.designation,
        status,
      }
    })

    const presentToday = staffList.filter((s) => s.status === 'present').length
    const absentToday = staffList.filter((s) => s.status === 'absent').length
    const onLeave = staffList.filter((s) => s.status === 'on-leave').length

    return NextResponse.json({
      totalStaff: staffList.length,
      presentToday,
      absentToday,
      onLeave,
      staffList,
    })
  } catch (error) {
    console.error('Error fetching attendance reports:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance reports' }, { status: 500 })
  }
}
