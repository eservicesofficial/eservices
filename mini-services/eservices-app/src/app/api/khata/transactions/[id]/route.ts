import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, sessionHasPermission } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!sessionHasPermission(session, 'khata', 'delete')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { id } = await params

    // Find the transaction to delete
    const transaction = await db.khataTransaction.findUnique({ where: { id } })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Verify the profile belongs to this unit
    const profile = await db.khataProfile.findUnique({ where: { id: transaction.profileId } })
    if (!profile || profile.unitCode !== session.unitCode) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const profileId = transaction.profileId

    // Get all transactions for this profile, ordered by creation time
    const allTransactions = await db.khataTransaction.findMany({
      where: { profileId },
      orderBy: { createdAt: 'asc' },
    })

    await logAction(session.unitCode, session.userId, session.name, session.role, 'DELETE_KHATA_TXN', id, { profileId, amount: transaction.amount }, request)

    // Delete the target transaction
    await db.khataTransaction.delete({ where: { id } })

    // Recalculate balance snapshots for all remaining transactions
    const remainingTransactions = allTransactions.filter((t) => t.id !== id)
    // Use openingBalance with null/NaN protection
    let runningBalance = (profile.openingBalance != null && !isNaN(profile.openingBalance))
      ? profile.openingBalance
      : 0

    for (const txn of remainingTransactions) {
      if (txn.type === 'in') {
        runningBalance += txn.amount
      } else {
        runningBalance -= txn.amount
      }
      // Update the balance snapshot
      await db.khataTransaction.update({
        where: { id: txn.id },
        data: { balanceSnapshot: runningBalance },
      })
    }

    return NextResponse.json({ success: true, recalculated: remainingTransactions.length })
  } catch (error) {
    console.error('Error deleting khata transaction:', error)
    return NextResponse.json({ error: 'Failed to delete khata transaction' }, { status: 500 })
  }
}
