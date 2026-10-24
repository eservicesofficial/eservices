# Task ID: 1 — Backend API Developer Work Record

## Task: Create 4 new API routes for Customer Folio multi-folio support

## Files Created:
1. `src/app/api/folio/customers/[id]/folios/route.ts`
2. `src/app/api/folio/customers/[id]/folios/[folioId]/entries/route.ts`
3. `src/app/api/folio/customers/[id]/shift/route.ts`
4. `src/app/api/folio/customers/[id]/entries/remove/route.ts`

## Summary of Each Endpoint:

### 1. POST `/api/folio/customers/[id]/folios` — Create New Folio
- **Permission**: `khata` `create`
- **Behavior**: Creates a new Folio for a customer with auto-generated `folioId` = `FOLIO-{visitNumber}` where visitNumber = existing folios count + 1
- **Side effects**: Creates a CustomerVisit record (checkInAt = now, checkOutAt = null)
- **Returns**: The new Folio object (201)
- **Guardrails**: Rejects archived customers, checks for duplicate folioId

### 2. GET `/api/folio/customers/[id]/folios/[folioId]/entries` — Get Folio Entries
- **Permission**: `khata` `access`
- **Behavior**: Fetches all Active ledger entries for a specific folio, ordered by createdAt ASC
- **Returns**: Entries array + summary (totalDebit, totalCredit, totalTax, currentBalance, entryCount)
- **Verification**: Confirms folio belongs to the specified customer

### 3. POST `/api/folio/customers/[id]/shift` — Shift Transactions
- **Permission**: `khata` `edit`
- **Body**: `{ entryIds: string[], targetFolioId: string }`
- **Behavior**: Moves selected entries to target folio, recalculates running balances for all affected folios (source + target)
- **Side effects**: Each entry description appended with `[Shifted to {folioId}]`, per-entry FolioAuditLog created
- **Returns**: `{ success, count, message }`
- **Guardrails**: Rejects entries already in target folio, validates all entry IDs exist and are Active

### 4. POST `/api/folio/customers/[id]/entries/remove` — Remove Entries
- **Permission**: `khata` `delete`
- **Body**: `{ entryIds: string[] }`
- **Behavior**: Soft-deletes entries by setting `status` to `'Cancelled'`, recalculates running balances for all affected folios
- **Returns**: `{ success, count, message }`
- **Guardrails**: Validates all entry IDs exist and are Active, reports missing IDs

## Patterns Used:
- Next.js 16 `params: Promise<{ id: string }>` async params
- `getSessionFromRequest(request)` + `sessionHasPermission(session, 'khata', action)`
- `db.$transaction(async (tx) => {...})` for all balance-modifying operations
- `logAction()` + `db.folioAuditLog.create()` for audit trail
- `getClientIp(request)` helper
- Chronological Active entry iteration for balance recalculation (starting from 0)
