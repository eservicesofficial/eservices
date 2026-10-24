import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, sessionHasPermission, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Transfer balance to another customer
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

    const body = await request.json()
    const { targetCustomerId, amount, description } = body

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Target customer ID is required' }, { status: 400 })
    }

    if (id === targetCustomerId) {
      return NextResponse.json({ error: 'Cannot transfer balance to the same customer' }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Transfer amount must be greater than 0' }, { status: 400 })
    }

    // Fetch both customers with active folios
    const [sourceCustomer, targetCustomer] = await Promise.all([
      db.customer.findUnique({
        where: { id },
        include: {
          folios: {
            where: { status: 'Active' },
            include: {
              ledgerEntries: {
                where: { status: 'Active' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      db.customer.findUnique({
        where: { id: targetCustomerId },
        include: {
          folios: {
            where: { status: 'Active' },
            include: {
              ledgerEntries: {
                where: { status: 'Active' },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ])

    if (!sourceCustomer || sourceCustomer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Source customer not found' }, { status: 404 })
    }

    if (!targetCustomer || targetCustomer.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Target customer not found' }, { status: 404 })
    }

    const sourceFolio = sourceCustomer.folios[0]
    const targetFolio = targetCustomer.folios[0]

    if (!sourceFolio) {
      return NextResponse.json({ error: 'Source customer has no active folio' }, { status: 400 })
    }

    if (!targetFolio) {
      return NextResponse.json({ error: 'Target customer has no active folio. Reopen the target customer first.' }, { status: 400 })
    }

    // Check source balance
    const sourceBalance = sourceFolio.ledgerEntries[0]?.balance ?? sourceCustomer.openingBalance ?? 0
    if (amount > sourceBalance) {
      return NextResponse.json(
        { error: `Transfer amount (${amount}) exceeds source customer balance (${sourceBalance})` },
        { status: 400 }
      )
    }

    const transferDate = new Date().toISOString().split('T')[0]
    const transferDesc = description || `Balance transfer to ${targetCustomer.fullName} (${targetCustomer.customerId})`

    // Process transfer in a transaction
    const result = await db.$transaction(async (tx) => {
      // Source: Credit (reduce balance)
      const sourceLastEntry = sourceFolio.ledgerEntries[0]
      const sourceRunningBalance = (sourceLastEntry?.balance ?? sourceCustomer.openingBalance ?? 0) - amount

      const sourceEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: sourceFolio.id,
          customerId: id,
          date: transferDate,
          type: 'Transfer',
          description: transferDesc,
          debit: 0,
          credit: amount,
          balance: sourceRunningBalance,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      // Target: Debit (increase balance)
      const targetLastEntry = targetFolio.ledgerEntries[0]
      const targetRunningBalance = (targetLastEntry?.balance ?? targetCustomer.openingBalance ?? 0) + amount

      const targetEntry = await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: targetFolio.id,
          customerId: targetCustomerId,
          date: transferDate,
          type: 'Transfer',
          description: `Balance received from ${sourceCustomer.fullName} (${sourceCustomer.customerId})`,
          debit: amount,
          credit: 0,
          balance: targetRunningBalance,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })

      return {
        sourceEntry,
        sourceRunningBalance,
        targetEntry,
        targetRunningBalance,
      }
    })

    await logAction(
      session.unitCode,
      session.userId,
      session.name,
      session.role,
      'TRANSFER_BALANCE',
      `${sourceCustomer.fullName} → ${targetCustomer.fullName}`,
      {
        sourceCustomerId: sourceCustomer.customerId,
        targetCustomerId: targetCustomer.customerId,
        amount: body.amount,
        sourceNewBalance: result.sourceRunningBalance,
        targetNewBalance: result.targetRunningBalance,
      },
      request
    )

    // Log to audit for both customers
    await db.folioAuditLog.createMany({
      data: [
        {
          unitCode: session.unitCode,
          customerId: id,
          folioId: sourceFolio.id,
          action: 'Transfer',
          target: 'LedgerEntry',
          details: JSON.stringify({
            direction: 'outgoing',
            amount: body.amount,
            targetCustomer: targetCustomer.customerId,
            targetCustomerName: targetCustomer.fullName,
            newBalance: result.sourceRunningBalance,
          }),
          userId: session.userId,
          userName: session.name,
          ipAddress: getClientIp(request),
          device: request.headers.get('user-agent') || '',
        },
        {
          unitCode: session.unitCode,
          customerId: targetCustomerId,
          folioId: targetFolio.id,
          action: 'Transfer',
          target: 'LedgerEntry',
          details: JSON.stringify({
            direction: 'incoming',
            amount: body.amount,
            sourceCustomer: sourceCustomer.customerId,
            sourceCustomerName: sourceCustomer.fullName,
            newBalance: result.targetRunningBalance,
          }),
          userId: session.userId,
          userName: session.name,
          ipAddress: getClientIp(request),
          device: request.headers.get('user-agent') || '',
        },
      ],
    })

    return NextResponse.json({
      success: true,
      source: {
        entry: result.sourceEntry,
        newBalance: result.sourceRunningBalance,
      },
      target: {
        entry: result.targetEntry,
        newBalance: result.targetRunningBalance,
      },
      message: `Transferred ${amount} from ${sourceCustomer.fullName} to ${targetCustomer.fullName}`,
    }, { status: 201 })
  } catch (error) {
    console.error('Error transferring balance:', error)
    return NextResponse.json({ error: 'Failed to transfer balance' }, { status: 500 })
  }
}
