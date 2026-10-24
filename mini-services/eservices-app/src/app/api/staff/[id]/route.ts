import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'staff', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify staff profile belongs to this unit
    const existing = await db.staffProfile.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
    }

    const member = await db.staffProfile.update({
      where: { id },
      data: {
        name: body.name,
        designation: body.designation,
        department: body.department,
        ...(body.dailyWageRate !== undefined && { dailyWageRate: body.dailyWageRate }),
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_STAFF', body.name, { staffId: id }, request)

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error updating staff profile:', error)
    return NextResponse.json({ error: 'Failed to update staff profile' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'staff', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify staff profile belongs to this unit
    const existing = await db.staffProfile.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_STAFF', existing.name, { staffId: id }, request)
    await db.staffProfile.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting staff profile:', error)
    return NextResponse.json({ error: 'Failed to delete staff profile' }, { status: 500 })
  }
}
