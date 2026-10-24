import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromRequest, logAction, isAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const data = await request.json()

    await logAction(session.unitCode, session.userId, session.name, session.role, 'IMPORT_DATA', '', {}, request)

    // Perform delete + recreate in a SINGLE transaction for atomicity.
    // Only operate on the current unit's data.
    await db.$transaction(async (tx) => {
      // Step 1: Delete everything for this unit (children before parents)
      await tx.refund.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.invoiceItem.deleteMany({ where: { invoice: { unitCode: session.unitCode } } })
      await tx.invoice.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.attendance.deleteMany({ where: { profile: { unitCode: session.unitCode } } })
      await tx.staffProfile.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.khataTransaction.deleteMany({ where: { profile: { unitCode: session.unitCode } } })
      await tx.khataProfile.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.pettyCashTransaction.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.pettyCashConfig.deleteMany({ where: { id: session.unitCode } })
      await tx.item.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.category.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.calcHistory.deleteMany({ where: { unitCode: session.unitCode } })
      await tx.settings.deleteMany({ where: { unitCode: session.unitCode } })

      // Step 2: Recreate all data in FK-safe order, setting unitCode to session.unitCode
      // 1. Settings — CRITICAL: Always include Unit business details as base to prevent
      //    shopName reverting to Prisma default when imported settings are partial
      {
        const unit = await tx.unit.findUnique({ where: { code: session.unitCode } })
        const businessDefaults = {
          shopName: unit?.name || '',
          shopAddress: unit?.address || '',
          shopPhone: unit?.phone || '',
          shopEmail: unit?.email || '',
          gstNumber: unit?.gstNumber || '',
        }

        if (data.settings?.length) {
          for (const s of data.settings) {
            await tx.settings.upsert({
              where: { unitCode: session.unitCode },
              update: { ...s, unitCode: session.unitCode },
              create: { ...businessDefaults, ...s, unitCode: session.unitCode },
            })
          }
        } else {
          // No settings in import — recreate from Unit details to avoid empty/defaults
          await tx.settings.create({
            data: { unitCode: session.unitCode, ...businessDefaults },
          })
        }
      }

      // 2. Categories (items depend on these) — strip id to avoid PK conflicts
      if (data.categories?.length) {
        await tx.category.createMany({
          data: data.categories.map(({ id: _id, ...c }: Record<string, unknown>) => ({ ...c, unitCode: session.unitCode })),
        })
      }

      // 3. Items (depends on categories) — strip id to avoid PK conflicts
      if (data.items?.length) {
        await tx.item.createMany({
          data: data.items.map(({ id: _id, ...i }: Record<string, unknown>) => ({ ...i, unitCode: session.unitCode })),
        })
      }

      // 4. Khata Profiles (transactions depend on these) — strip id to avoid PK conflicts
      if (data.khataProfiles?.length) {
        await tx.khataProfile.createMany({
          data: data.khataProfiles.map(({ id: _id, ...p }: Record<string, unknown>) => ({ ...p, unitCode: session.unitCode })),
        })
      }

      // 5. Petty Cash Config
      if (data.pettyCashConfig?.length) {
        for (const c of data.pettyCashConfig) {
          await tx.pettyCashConfig.upsert({
            where: { id: session.unitCode },
            update: { amount: c.amount },
            create: { id: session.unitCode, amount: c.amount },
          })
        }
      }

      // 6. Staff Profiles (attendance depends on these) — strip id to avoid PK conflicts
      if (data.staffProfiles?.length) {
        await tx.staffProfile.createMany({
          data: data.staffProfiles.map(({ id: _id, ...s }: Record<string, unknown>) => ({ ...s, unitCode: session.unitCode })),
        })
      }

      // 7. Invoices (with invoiceItems) — refunds depend on these — strip id to avoid PK conflicts
      if (data.invoices?.length) {
        for (const inv of data.invoices) {
          const { id: _invId, invoiceItems, refunds, ...invoiceData } = inv
          await tx.invoice.create({
            data: {
              ...invoiceData,
              unitCode: session.unitCode,
              invoiceItems: Array.isArray(invoiceItems) && invoiceItems.length > 0
                ? {
                    create: invoiceItems.map((item: any) => ({
                      itemId: item.itemId || '',
                      name: String(item.name || ''),
                      description: String(item.description || ''),
                      qty: parseInt(String(item.qty)) || 0,
                      rate: parseFloat(String(item.rate)) || 0,
                      total: parseFloat(String(item.total)) || 0,
                    })),
                  }
                : undefined,
            },
          })
        }
      }

      // 8. Refunds — AFTER invoices (depends on originalInvoiceId FK)
      if (data.refunds?.length) {
        for (const refund of data.refunds) {
          await tx.refund.create({
            data: { ...refund, unitCode: session.unitCode },
          })
        }
      }

      // 9. Petty Cash Transactions
      if (data.pettyCashTransactions?.length) {
        await tx.pettyCashTransaction.createMany({
          data: data.pettyCashTransactions.map((t: Record<string, unknown>) => ({ ...t, unitCode: session.unitCode })),
        })
      }

      // 10. Khata Transactions — AFTER profiles (depends on profileId FK)
      if (data.khataTransactions?.length) {
        await tx.khataTransaction.createMany({
          data: data.khataTransactions.map(({ unitCode: _uc, ...t }: Record<string, unknown>) => t),
        })
      }

      // 11. Attendance — AFTER staffProfiles (depends on profileId FK)
      if (data.attendance?.length) {
        await tx.attendance.createMany({
          data: data.attendance.map(({ unitCode: _uc, ...a }: Record<string, unknown>) => a),
        })
      }

      // 12. Calculator History
      if (data.calcHistory?.length) {
        await tx.calcHistory.createMany({
          data: data.calcHistory.map((c: Record<string, unknown>) => ({ ...c, unitCode: session.unitCode })),
        })
      }
    })

    return NextResponse.json({ success: true, message: 'Data imported successfully' })
  } catch (error) {
    console.error('Error importing data:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to import data: ${message}` }, { status: 500 })
  }
}
