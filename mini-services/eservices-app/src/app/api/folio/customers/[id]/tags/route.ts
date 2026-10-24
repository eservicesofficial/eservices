import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// GET: List customer tags
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

    const tags = await db.customerTagAssignment.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ tags: tags.map(t => t.tagName) })
  } catch (error) {
    console.error('Error fetching customer tags:', error)
    return NextResponse.json({ error: 'Failed to fetch customer tags' }, { status: 500 })
  }
}

// POST: Add tag to customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const body = await request.json()
    const { tagName } = body

    if (!tagName?.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    const trimmedTag = tagName.trim()

    // Check if tag already assigned
    const existing = await db.customerTagAssignment.findUnique({
      where: {
        customerId_tagName: {
          customerId: id,
          tagName: trimmedTag,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Tag already assigned to this customer' }, { status: 409 })
    }

    const tag = await db.customerTagAssignment.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        tagName: trimmedTag,
      },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ADD_CUSTOMER_TAG',
      customer.fullName,
      {
        customerId: customer.customerId,
        tagName: trimmedTag,
      },
      request
    )

    return NextResponse.json({ tagName: tag.tagName }, { status: 201 })
  } catch (error) {
    console.error('Error adding customer tag:', error)
    return NextResponse.json({ error: 'Failed to add customer tag' }, { status: 500 })
  }
}

// DELETE: Remove tag from customer (use query param ?tagName=X)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const tagName = searchParams.get('tagName')

    if (!tagName) {
      return NextResponse.json({ error: 'tagName query parameter is required' }, { status: 400 })
    }

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer || customer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const existing = await db.customerTagAssignment.findUnique({
      where: {
        customerId_tagName: {
          customerId: id,
          tagName,
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tag not found on this customer' }, { status: 404 })
    }

    await db.customerTagAssignment.delete({
      where: { id: existing.id },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'REMOVE_CUSTOMER_TAG',
      customer.fullName,
      {
        customerId: customer.customerId,
        tagName,
      },
      request
    )

    return NextResponse.json({ success: true, removedTag: tagName })
  } catch (error) {
    console.error('Error removing customer tag:', error)
    return NextResponse.json({ error: 'Failed to remove customer tag' }, { status: 500 })
  }
}
