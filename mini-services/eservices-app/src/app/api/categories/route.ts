import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await db.category.findMany({
      where: { unitCode: session.unitCode },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
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
    const category = await db.category.create({
      data: {
        name: body.name,
        description: body.description || '',
        image: body.image || '',
        unitCode: session.unitCode,
      },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'CREATE_CATEGORY', body.name, { categoryId: category.id }, request)

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
