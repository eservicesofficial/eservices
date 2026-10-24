import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction } from '@/lib/auth'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown'
}

// POST: Admin control center actions
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin only
    if (session.role !== 'Admin' && session.role !== 'SuperAdmin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'merge-customers':
        return handleMergeCustomers(session, body, request)
      case 'force-adjustment':
        return handleForceAdjustment(session, body, request)
      case 'force-settlement':
        return handleForceSettlement(session, body, request)
      case 'force-checkout':
        return handleForceCheckout(session, body, request)
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid actions: merge-customers, force-adjustment, force-settlement, force-checkout` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in admin action:', error)
    return NextResponse.json({ error: 'Failed to perform admin action' }, { status: 500 })
  }
}

// Merge two customers: source into target (all source data moved to target, source archived)
async function handleMergeCustomers(
  session: { unitCode: string; userId: string; name: string; role: string },
  body: Record<string, unknown>,
  request: NextRequest
) {
  const { sourceId, targetId, reason } = body

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 })
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: 'Source and target cannot be the same' }, { status: 400 })
  }

  const [source, target] = await Promise.all([
    db.customer.findUnique({ where: { id: sourceId as string } }),
    db.customer.findUnique({ where: { id: targetId as string } }),
  ])

  if (!source || source.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Source customer not found' }, { status: 404 })
  }
  if (!target || target.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Target customer not found' }, { status: 404 })
  }

  const result = await db.$transaction(async (tx) => {
    // Move all source folios to target
    await tx.folio.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source ledger entries to target
    await tx.ledgerEntry.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source documents
    await tx.customerDocument.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source notes
    await tx.customerNote.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source visits
    await tx.customerVisit.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source settlements
    await tx.settlement.updateMany({
      where: { customerId: source.id },
      data: { customerId: target.id },
    })

    // Move all source tags
    const sourceTags = await tx.customerTagAssignment.findMany({
      where: { customerId: source.id },
    })
    for (const tag of sourceTags) {
      try {
        await tx.customerTagAssignment.create({
          data: {
            unitCode: session.unitCode,
            customerId: target.id,
            tagName: tag.tagName,
          },
        })
      } catch {
        // Tag already exists on target, skip
      }
    }
    await tx.customerTagAssignment.deleteMany({
      where: { customerId: source.id },
    })

    // Archive source customer
    const archived = await tx.customer.update({
      where: { id: source.id },
      data: {
        status: 'Archived',
        internalNotes: `[MERGED into ${target.customerId}] ${reason || ''}\n${source.internalNotes || ''}`,
      },
    })

    return { archived }
  })

  await logAction(
    session.unitCode,
    session.userId,
    session.name,
    session.role,
    'MERGE_CUSTOMERS',
    `${source.fullName} → ${target.fullName}`,
    {
      sourceId: source.customerId,
      targetId: target.customerId,
      reason: body.reason,
    },
    request
  )

  await db.folioAuditLog.create({
    data: {
      unitCode: session.unitCode,
      customerId: target.id,
      action: 'Edit',
      target: 'Customer',
      details: JSON.stringify({
        mergeSource: source.customerId,
        mergeSourceName: source.fullName,
        reason: body.reason,
      }),
      userId: session.userId,
      userName: session.name,
      ipAddress: getClientIp(request),
      device: request.headers.get('user-agent') || '',
    },
  })

  return NextResponse.json({
    success: true,
    message: `Merged ${source.fullName} (${source.customerId}) into ${target.fullName} (${target.customerId})`,
  })
}

// Force adjustment: directly adjust balance
async function handleForceAdjustment(
  session: { unitCode: string; userId: string; name: string; role: string },
  body: Record<string, unknown>,
  request: NextRequest
) {
  const { customerId, amount, description } = body

  if (!customerId || !amount) {
    return NextResponse.json({ error: 'customerId and amount are required' }, { status: 400 })
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId as string },
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
  })

  if (!customer || customer.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const activeFolio = customer.folios[0]
  if (!activeFolio) {
    return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
  }

  const adjustAmount = Number(amount)
  const lastEntry = activeFolio.ledgerEntries[0]
  const prevBalance = lastEntry?.balance ?? customer.openingBalance ?? 0

  // Positive amount = debit (increase balance), negative = credit (decrease balance)
  const newBalance = prevBalance + adjustAmount

  const entry = await db.ledgerEntry.create({
    data: {
      unitCode: session.unitCode,
      folioId: activeFolio.id,
      customerId: customer.id,
      date: new Date().toISOString().split('T')[0],
      type: 'Charge',
      description: `[FORCE ADJUSTMENT] ${description || 'Admin adjustment'}`,
      debit: adjustAmount > 0 ? adjustAmount : 0,
      credit: adjustAmount < 0 ? Math.abs(adjustAmount) : 0,
      balance: newBalance,
      userId: session.userId,
      userName: session.name,
      status: 'Active',
    },
  })

  await logAction(
    session.unitCode,
    session.userId,
    session.name,
    session.role,
    'FORCE_ADJUSTMENT',
    customer.fullName,
    {
      customerId: customer.customerId,
      amount: adjustAmount,
      previousBalance: prevBalance,
      newBalance,
      description: body.description,
    },
    request
  )

  await db.folioAuditLog.create({
    data: {
      unitCode: session.unitCode,
      customerId: customer.id,
      folioId: activeFolio.id,
      action: 'Edit',
      target: 'LedgerEntry',
      details: JSON.stringify({
        forceAdjustment: true,
        amount: adjustAmount,
        previousBalance: prevBalance,
        newBalance,
      }),
      userId: session.userId,
      userName: session.name,
      ipAddress: getClientIp(request),
      device: request.headers.get('user-agent') || '',
    },
  })

  return NextResponse.json({
    success: true,
    entry,
    previousBalance: prevBalance,
    newBalance,
    message: `Force adjustment of ${adjustAmount} applied to ${customer.fullName}`,
  })
}

// Force settlement regardless of balance
async function handleForceSettlement(
  session: { unitCode: string; userId: string; name: string; role: string },
  body: Record<string, unknown>,
  request: NextRequest
) {
  const { customerId, description } = body

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId as string },
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
  })

  if (!customer || customer.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const activeFolio = customer.folios[0]
  if (!activeFolio) {
    return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
  }

  const lastEntry = activeFolio.ledgerEntries[0]
  const outstandingBalance = lastEntry?.balance ?? customer.openingBalance ?? 0

  const result = await db.$transaction(async (tx) => {
    // If there's outstanding balance, write it off with a credit entry
    if (outstandingBalance > 0) {
      await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: customer.id,
          date: new Date().toISOString().split('T')[0],
          type: 'Discount',
          description: `[FORCE SETTLEMENT] Balance written off: ${description || ''}`,
          debit: 0,
          credit: outstandingBalance,
          balance: 0,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })
    }

    // Create settlement record
    const settlement = await tx.settlement.create({
      data: {
        unitCode: session.unitCode,
        customerId: customer.id,
        folioId: activeFolio.id,
        amount: outstandingBalance,
        mode: 'Force',
        reference: 'FORCE',
        description: `Force settlement by admin: ${description || ''}`,
        userId: session.userId,
        userName: session.name,
      },
    })

    // Lock folio and set to settled
    await tx.folio.update({
      where: { id: activeFolio.id },
      data: {
        status: 'Settled',
        lockedAt: new Date(),
        lockedBy: session.userId,
        settledAt: new Date(),
        settledBy: session.userId,
      },
    })

    // Update customer status
    const updatedCustomer = await tx.customer.update({
      where: { id: customer.id },
      data: { status: 'Settled' },
    })

    // Close open visits
    await tx.customerVisit.updateMany({
      where: { customerId: customer.id, checkOutAt: null },
      data: { checkOutAt: new Date() },
    })

    return { settlement, updatedCustomer }
  })

  await logAction(
    session.unitCode,
    session.userId,
    session.name,
    session.role,
    'FORCE_SETTLEMENT',
    customer.fullName,
    {
      customerId: customer.customerId,
      folioId: activeFolio.folioId,
      writtenOffBalance: outstandingBalance,
      description: body.description,
    },
    request
  )

  await db.folioAuditLog.create({
    data: {
      unitCode: session.unitCode,
      customerId: customer.id,
      folioId: activeFolio.id,
      action: 'Settlement',
      target: 'Folio',
      details: JSON.stringify({
        force: true,
        writtenOffBalance: outstandingBalance,
        description: body.description,
      }),
      userId: session.userId,
      userName: session.name,
      ipAddress: getClientIp(request),
      device: request.headers.get('user-agent') || '',
    },
  })

  return NextResponse.json({
    success: true,
    settlement: result.settlement,
    customer: result.updatedCustomer,
    message: `Force settlement applied to ${customer.fullName}. Written off: ${outstandingBalance}`,
  })
}

// Force checkout regardless of balance
async function handleForceCheckout(
  session: { unitCode: string; userId: string; name: string; role: string },
  body: Record<string, unknown>,
  request: NextRequest
) {
  const { customerId, description } = body

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId as string },
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
  })

  if (!customer || customer.unitCode !== session.unitCode) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const activeFolio = customer.folios[0]
  if (!activeFolio) {
    return NextResponse.json({ error: 'No active folio found' }, { status: 400 })
  }

  const lastEntry = activeFolio.ledgerEntries[0]
  const outstandingBalance = lastEntry?.balance ?? customer.openingBalance ?? 0

  const result = await db.$transaction(async (tx) => {
    // Write off balance if any
    if (outstandingBalance > 0) {
      await tx.ledgerEntry.create({
        data: {
          unitCode: session.unitCode,
          folioId: activeFolio.id,
          customerId: customer.id,
          date: new Date().toISOString().split('T')[0],
          type: 'Discount',
          description: `[FORCE CHECKOUT] Balance written off: ${description || ''}`,
          debit: 0,
          credit: outstandingBalance,
          balance: 0,
          userId: session.userId,
          userName: session.name,
          status: 'Active',
        },
      })
    }

    // Lock and archive folio
    await tx.folio.update({
      where: { id: activeFolio.id },
      data: {
        status: 'Archived',
        lockedAt: new Date(),
        lockedBy: session.userId,
      },
    })

    // Update customer
    const updatedCustomer = await tx.customer.update({
      where: { id: customer.id },
      data: { status: 'CheckedOut' },
    })

    // Close visits
    await tx.customerVisit.updateMany({
      where: { customerId: customer.id, checkOutAt: null },
      data: { checkOutAt: new Date() },
    })

    return { updatedCustomer }
  })

  await logAction(
    session.unitCode,
    session.userId,
    session.name,
    session.role,
    'FORCE_CHECKOUT',
    customer.fullName,
    {
      customerId: customer.customerId,
      folioId: activeFolio.folioId,
      writtenOffBalance: outstandingBalance,
      description: body.description,
    },
    request
  )

  await db.folioAuditLog.create({
    data: {
      unitCode: session.unitCode,
      customerId: customer.id,
      folioId: activeFolio.id,
      action: 'Checkout',
      target: 'Folio',
      details: JSON.stringify({
        force: true,
        writtenOffBalance: outstandingBalance,
        description: body.description,
      }),
      userId: session.userId,
      userName: session.name,
      ipAddress: getClientIp(request),
      device: request.headers.get('user-agent') || '',
    },
  })

  return NextResponse.json({
    success: true,
    customer: result.updatedCustomer,
    message: `Force checkout applied to ${customer.fullName}. Written off: ${outstandingBalance}`,
  })
}
