import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

// Helper: Generate sequential ID using IdCounter
async function generateId(prefix: string): Promise<string> {
  const counter = await db.idCounter.upsert({
    where: { prefix },
    update: { lastNumber: { increment: 1 } },
    create: { prefix, lastNumber: 1 },
  })
  return `${prefix}-${String(counter.lastNumber).padStart(3, '0')}`
}

// POST: Migrate existing KhataProfile data to new Customer system
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin only for migration
    if (session.role !== 'Admin' && session.role !== 'SuperAdmin') {
      return NextResponse.json({ error: 'Admin access required for migration' }, { status: 403 })
    }

    const body = await request.json()
    const { dryRun = false } = body

    // Find all KhataProfiles for this unit that haven't been migrated yet
    const khataProfiles = await db.khataProfile.findMany({
      where: {
        unitCode: session.unitCode,
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (khataProfiles.length === 0) {
      return NextResponse.json({
        message: 'No KhataProfile records found for migration',
        migrated: 0,
        skipped: 0,
        errors: [] as { name: string; error: string }[],
      })
    }

    // Get already migrated profile IDs (check by internalNotes marker)
    const existingCustomers = await db.customer.findMany({
      where: {
        unitCode: session.unitCode,
        internalNotes: { contains: '[MIGRATED_FROM_KHATA]' },
      },
      select: { internalNotes: true },
    })

    const migratedKhataIds = new Set<string>()
    for (const c of existingCustomers) {
      const match = c.internalNotes.match(/KhataProfile ID: ([a-zA-Z0-9]+)/)
      if (match) migratedKhataIds.add(match[1])
    }

    const toMigrate = khataProfiles.filter(p => !migratedKhataIds.has(p.id))
    const skipped = khataProfiles.length - toMigrate.length

    if (toMigrate.length === 0) {
      return NextResponse.json({
        message: 'All KhataProfile records have already been migrated',
        migrated: 0,
        skipped: khataProfiles.length,
        errors: [],
      })
    }

    if (dryRun) {
      return NextResponse.json({
        message: 'Dry run - no data will be modified',
        readyToMigrate: toMigrate.length,
        skipped: skipped,
        profiles: toMigrate.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          type: p.type,
          openingBalance: p.openingBalance,
          transactionCount: p.transactions.length,
        })),
      })
    }

    // Actual migration
    const results = {
      migrated: 0,
      skipped: skipped,
      errors: [] as { name: string; error: string }[],
    }

    for (const profile of toMigrate) {
      try {
        // Generate IDs BEFORE the transaction
        const customerId = await generateId('CUST')
        const folioId = await generateId('FOLIO')

        await db.$transaction(async (tx) => {

          // Create Customer
          const customer = await tx.customer.create({
            data: {
              unitCode: session.unitCode,
              customerId,
              primaryFolioId: folioId,
              fullName: profile.name,
              mobile: profile.phone || '',
              whatsapp: profile.phone || '',
              email: '',
              customerType: profile.type === 'Supplier' ? 'Supplier' : 'Retail',
              creditLimit: 0,
              internalNotes: `[MIGRATED_FROM_KHATA] KhataProfile ID: ${profile.id}`,
              status: 'Active',
              gstNumber: '',
              panNumber: '',
              aadhaarNumber: '',
              openingBalance: profile.openingBalance || 0,
            },
          })

          // Create Folio
          const folio = await tx.folio.create({
            data: {
              unitCode: session.unitCode,
              folioId,
              customerId: customer.id,
              visitNumber: 1,
              status: 'Active',
            },
          })

          // Create Visit
          await tx.customerVisit.create({
            data: {
              unitCode: session.unitCode,
              customerId: customer.id,
              visitNumber: 1,
              checkInAt: new Date(),
            },
          })

          // Create LedgerEntries from transactions
          let runningBalance = profile.openingBalance || 0

          for (const txn of profile.transactions) {
            if (txn.type === 'in') {
              // Credit - money coming in (payment)
              runningBalance -= txn.amount
            } else {
              // Debit - money going out (charge)
              runningBalance += txn.amount
            }

            await tx.ledgerEntry.create({
              data: {
                unitCode: session.unitCode,
                folioId: folio.id,
                customerId: customer.id,
                date: txn.date || txn.createdAt.toISOString().split('T')[0],
                type: txn.type === 'in' ? 'Payment' : 'Charge',
                description: txn.description || `Migrated: ${txn.type} ${txn.amount}`,
                debit: txn.type === 'out' ? txn.amount : 0,
                credit: txn.type === 'in' ? txn.amount : 0,
                balance: runningBalance,
                userId: session.userId,
                userName: session.name,
                status: 'Active',
              },
            })
          }

          results.migrated++
        })
      } catch (error) {
        results.errors.push({
          name: profile.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      message: `Migration complete. Migrated ${results.migrated} profiles, skipped ${results.skipped}, errors: ${results.errors.length}`,
      ...results,
    })
  } catch (error) {
    console.error('Error during migration:', error)
    return NextResponse.json({ error: 'Failed to perform migration' }, { status: 500 })
  }
}
