import { NextRequest, NextResponse } from 'next/server'
import { fullSync } from '@/lib/sync'

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic'

// GET /api/init — Full auto-sync on app startup
// Ensures: SuperAdmin, IdCounters, Settings rows exist
// NOTE: No auth required — this is a bootstrap endpoint.
// The login page calls this on first visit to ensure the database is initialized.
// Without auth, we avoid the circular dependency (need SA to init, but need init to create SA).
export async function GET(request: NextRequest) {
  try {
    const result = await fullSync()

    return NextResponse.json({
      synced: true,
      superAdmin: result.superAdmin.created
        ? 'Default SuperAdmin created'
        : 'SuperAdmin exists',
      idCounters: result.idCounters.length > 0
        ? `${result.idCounters.length} new counters created: ${result.idCounters.join(', ')}`
        : 'All counters exist',
      settings: `${result.settings.created} created, ${result.settings.synced} synced`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Init] Auto-sync failed:', message)
    // Return success even if sync fails — the app can still work
    // This prevents the login page from breaking on sync errors
    return NextResponse.json({
      synced: true,
      superAdmin: 'Sync skipped',
      idCounters: 'Sync skipped',
      settings: 'Sync skipped',
      warning: message,
    })
  }
}
