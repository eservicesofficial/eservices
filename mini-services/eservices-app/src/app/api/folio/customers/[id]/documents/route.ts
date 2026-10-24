import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

// GET: List customer documents
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

    const documents = await db.customerDocument.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching customer documents:', error)
    return NextResponse.json({ error: 'Failed to fetch customer documents' }, { status: 500 })
  }
}

// POST: Upload/add customer document
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
    const { type, name, url, notes } = body

    if (!type) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }

    const validTypes = ['Aadhaar', 'PAN', 'GST', 'Agreement', 'Receipt', 'Custom']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const document = await db.customerDocument.create({
      data: {
        unitCode: session.unitCode,
        customerId: id,
        type,
        name: name || '',
        url: url || '',
        notes: notes || '',
      },
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'ADD_CUSTOMER_DOCUMENT',
      customer.fullName,
      {
        customerId: customer.customerId,
        documentType: type,
        documentName: name,
      },
      request
    )

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error adding customer document:', error)
    return NextResponse.json({ error: 'Failed to add customer document' }, { status: 500 })
  }
}
