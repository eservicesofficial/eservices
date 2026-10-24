import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'inventory', 'edit')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify category belongs to this unit
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const category = await db.category.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        ...(body.image !== undefined ? { image: body.image } : {}),
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_CATEGORY', body.name, { categoryId: id }, request)

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
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
    if (!sessionHasPermission(session, 'inventory', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Verify category belongs to this unit
    const existing = await db.category.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_CATEGORY', existing.name, { categoryId: id }, request)

    // Null out categoryId on items first (FK constraint), then delete category
    await db.$transaction([
      db.item.updateMany({ where: { categoryId: id }, data: { categoryId: null, category: 'Uncategorized' } }),
      db.category.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
