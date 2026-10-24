import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

// Normalize image URLs: old /uploads/items/x.jpg → /api/uploads/items/x.jpg
function normalizeImageUrl(url: string): string {
  if (!url) return ''
  // Already uses API route
  if (url.startsWith('/api/uploads/')) return url
  // Old static path → convert to API route
  if (url.startsWith('/uploads/items/')) {
    return url.replace('/uploads/items/', '/api/uploads/items/')
  }
  return url
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    const items = await db.item.findMany({
      where: { unitCode: session.unitCode, ...(categoryId ? { categoryId } : {}) },
      include: { categoryRef: true },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to match frontend expectations
    // Normalize image URLs: old /uploads/items/x.jpg → /api/uploads/items/x.jpg
    const result = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.categoryRef?.name || item.category || 'Uncategorized',
      categoryId: item.categoryId || '',
      categoryName: item.categoryRef?.name || item.category || 'Uncategorized',
      price: item.price,
      quantity: item.quantity,
      description: item.description,
      imageUrl: normalizeImageUrl(item.image || ''),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error fetching items:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!sessionHasPermission(session, 'inventory', 'create')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()

    // Resolve category name from categoryId
    let categoryName = 'Uncategorized'
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
        // category lookup failed, use default
      }
    } else if (body.category && typeof body.category === 'string' && body.category.trim()) {
      categoryName = body.category.trim()
    }

    const imageUrl = body.imageUrl || body.image || ''

    const item = await db.item.create({
      data: {
        name: String(body.name || '').trim(),
        category: categoryName,
        categoryId: body.categoryId || null,
        price: Number(body.price) || 0,
        quantity: Number(body.quantity) || 0,
        description: String(body.description || '').trim(),
        image: imageUrl,
        unitCode: session.unitCode,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_ITEM', item.name, { itemId: item.id }, request)

    const result = {
      id: item.id,
      name: item.name,
      category: categoryName,
      categoryId: item.categoryId || '',
      categoryName: categoryName,
      price: item.price,
      quantity: item.quantity,
      description: item.description,
      imageUrl: normalizeImageUrl(item.image),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating item:', error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
