-- ElectraScan — Close tenant_id IS NULL escape hatch in RLS policies
--
-- Step 1: Backfill any legacy rows that were written before the tenant
--         migration (tenant_id IS NULL). Assigns them to Vesh Electrical,
--         the only tenant that existed prior to this migration.
--
-- Step 2: Recreate SELECT policies on all core tables without the
--         OR tenant_id IS NULL clause so the hatch is fully closed.
--
-- Safe to run: idempotent DROP POLICY IF EXISTS guards; UPDATE is a no-op
-- when no NULL rows remain.

-- ─── Step 1: Backfill legacy rows ────────────────────────────────────────────

UPDATE estimates       SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE scans           SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE rate_library    SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE variations      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE timesheets      SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE milestone_claims SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- ─── Step 2: Recreate SELECT policies without escape hatch ───────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant estimates" ON estimates;
CREATE POLICY "Tenant members can select own tenant estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant scans" ON scans;
CREATE POLICY "Tenant members can select own tenant scans"
  ON scans FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant rate_library" ON rate_library;
CREATE POLICY "Tenant members can select own tenant rate_library"
  ON rate_library FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant variations" ON variations;
CREATE POLICY "Tenant members can select own tenant variations"
  ON variations FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant timesheets" ON timesheets;
CREATE POLICY "Tenant members can select own tenant timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant milestone_claims" ON milestone_claims;
CREATE POLICY "Tenant members can select own tenant milestone_claims"
  ON milestone_claims FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());
