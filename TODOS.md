# TODOS

## Multi-tenant / Auth

- **Title:** Remove `tenant_id IS NULL` escape hatch in RLS policies
  **Priority:** P1
  **Detail:** The SELECT policies on estimates, scans, rate_library, variations, timesheets, and milestone_claims include `OR tenant_id IS NULL` for backward compatibility. Once all rows have tenant_id populated, this hatch should be closed. Track migration of existing rows and then remove the OR clause.
  **Files:** `supabase/migrations/20260506130000_tenant_id_rls.sql`

- **Title:** Replace hardcoded `getCurrentTenantId()` with live Supabase RPC
  **Priority:** P2
  **Detail:** `lib/tenants.ts` returns a hardcoded UUID. Once multi-tenant auth is wired, replace with `supabase.rpc('get_tenant_id')`.
  **Files:** `lib/tenants.ts`

- **Title:** Tenant onboarding — first-owner bootstrap path
  **Priority:** P2
  **Detail:** Creating a tenant requires an existing owner membership (Codex finding #4). Need a manual SQL script or a Supabase Edge Function that bootstraps the first owner for a new tenant without requiring a pre-existing membership.

## Detection & Scans

- **Title:** Wire ScanDetailScreen to live Supabase
  **Priority:** P2
  **Detail:** `screens/ScanDetailScreen.tsx` (991 lines) uses entirely mock data. Supabase `scans` and `detected_items` tables exist — wire up live fetch with the existing `useSupabaseQuery` pattern.
  **Files:** `screens/ScanDetailScreen.tsx`

- **Title:** Wire ProjectReportsScreen to live Supabase
  **Priority:** P2
  **Detail:** `screens/ProjectReportsScreen.tsx` (945 lines) uses mock data. Connect to estimates + scans tables.
  **Files:** `screens/ProjectReportsScreen.tsx`

## Estimates

- **Title:** Handle failed milestone claim writes correctly
  **Priority:** P1
  **Detail:** `submitMilestoneClaim` in `services/supabaseData.ts:339` returns a reference even on insert failure. The UI advances the milestone to `invoiced_draft` unconditionally. Add error handling: only advance state on successful insert.
  **Files:** `services/supabaseData.ts`, `screens/ProjectReportsScreen.tsx`

## Testing

- **Title:** Bootstrap test framework (Vitest + React Testing Library)
  **Priority:** P2
  **Detail:** No test coverage exists. Key paths to cover first: Settings screen CRUD, upsertCompanyProfile, fetchCompanyProfile fallback, useSupabaseQuery mock/live switching, symbol_map duplicate key guard.

## Completed

