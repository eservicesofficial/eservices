import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

// Normalize image URLs: old /uploads/items/x.jpg → /api/uploads/items/x.jpg
function normalizeImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/api/uploads/')) return url
  if (url.startsWith('/uploads/items/')) {
    return url.replace('/uploads/items/', '/api/uploads/items/')
  }
  return url
}

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

    // Verify item belongs to this unit
    const existing = await db.item.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Resolve category name from categoryId
    let categoryName = body.category || 'Uncategorized'
    if (body.categoryId) {
      try {
        const category = await db.category.findUnique({
          where: { id: body.categoryId },
          select: { name: true },
        })
        if (category) {
          categoryName = category.name
        }
      } catch {
        // category lookup failed
      }
    }

    // Use provided imageUrl (even if empty, which means "clear the image").
    // Only fall back to existing.image if imageUrl was not provided at all.
    const imageUrl = 'imageUrl' in body
      ? String(body.imageUrl || '').trim()
      : String(body.image || existing.image || '').trim()

    const item = await db.item.update({
      where: { id },
      data: {
        name: String(body.name || '').trim(),
        category: categoryName,
        categoryId: body.categoryId || null,
        price: Number(body.price) || 0,
        quantity: Number(body.quantity) || 0,
        description: String(body.description || '').trim(),
        image: imageUrl,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'UPDATE_ITEM', item.name, { itemId: item.id }, request)

    const result = {
      id: item.id,
      name: item.name,
      categoryId: item.categoryId || '',
      categoryName: categoryName,
      price: item.price,
      quantity: item.quantity,
      description: item.description,
      imageUrl: normalizeImageUrl(item.image),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
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

    // Verify item belongs to this unit
    const existing = await db.item.findUnique({ where: { id } })
    if (!existing || existing.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_ITEM', existing.name, { itemId: id }, request)
    await db.item.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
