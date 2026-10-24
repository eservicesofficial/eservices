import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = new Date().getFullYear().toString()
    
    // Find the highest existing invoice number for this unit and year
    const invoices = await db.invoice.findMany({
      where: {
        invoiceNumber: { startsWith: `FP-${year}` },
        unitCode: session.unitCode,
      },
      select: { invoiceNumber: true },
      orderBy: { createdAt: 'desc' },
    })

    let nextNum = 1
    if (invoices.length > 0) {
      // Extract numbers from existing invoice numbers and find max
      for (const inv of invoices) {
        const parts = inv.invoiceNumber.split('-')
        if (parts.length >= 3) {
          const num = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(num) && num >= nextNum) {
            nextNum = num + 1
          }
        }
      }
    }

    const nextNumber = `FP-${year}-${String(nextNum).padStart(3, '0')}`

    // Double-check it doesn't exist within this unit
    const existing = await db.invoice.findFirst({
      where: { invoiceNumber: nextNumber, unitCode: session.unitCode },
    })
    if (existing) {
      // If somehow it exists, increment again
      const fallbackNumber = `FP-${year}-${String(nextNum + 1).padStart(3, '0')}`
      return NextResponse.json({ nextNumber: fallbackNumber })
    }

    return NextResponse.json({ nextNumber })
  } catch (error) {
    console.error('Error generating next invoice number:', error)
    return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 })
  }
}
