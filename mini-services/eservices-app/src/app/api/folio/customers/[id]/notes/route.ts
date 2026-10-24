import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// GET: List customer notes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'access')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const notes = await db.customerNote.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    })

    // Filter private notes for non-admin users
    const filteredNotes = session.role === 'Admin'
      ? notes
      : notes.filter(n => !n.isPrivate)

    return NextResponse.json({ notes: filteredNotes })
  } catch (error) {
    console.error('Error fetching customer notes:', error)
    return NextResponse.json({ error: 'Failed to fetch customer notes' }, { status: 500 })
  }
}

// POST: Add customer note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { type, content, isPrivate } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
    }

    const validTypes = ['Internal', 'Customer', 'Staff', 'Private']
    if (type && !validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Only Admin can mark notes as private
    const noteIsPrivate = isPrivate === true && session.role === 'Admin'

    const note = await db.customerNote.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        type: type || 'Internal',
        content: content.trim(),
        isPrivate: noteIsPrivate,
        userId: session.userId,
        userName: session.name,
      },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ADD_CUSTOMER_NOTE',
      customer.fullName,
      {
        customerId: customer.customerId,
        noteType: type || 'Internal',
        isPrivate: noteIsPrivate,
      },
      request
    )

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Error adding customer note:', error)
    return NextResponse.json({ error: 'Failed to add customer note' }, { status: 500 })
  }
}
