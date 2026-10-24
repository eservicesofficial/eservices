import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(4, '0')}`
}

// POST: Generate a new invoice number
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceNumber = await generateId('INV')
    return NextResponse.json({ invoiceNumber })
  } catch (error) {
    console.error('Error generating invoice number:', error)
    return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 })
  }
}