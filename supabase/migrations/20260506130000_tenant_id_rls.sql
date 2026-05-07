-- ElectraScan — RLS tenant-filtering policies
--
-- Adds SELECT and INSERT RLS policies on all core tables so that reads are
-- automatically scoped to the current user's tenant (via public.get_tenant_id()).
--
-- Backward-compatible: rows with tenant_id IS NULL remain visible so that
-- existing data written before the tenant migration is not hidden.
--
-- Existing owner_id policies are NOT removed — they continue to work
-- alongside these tenant policies.
--
-- Depends on: 20260506120000_create_tenants_schema.sql (public.get_tenant_id func)
-- Idempotent: DROP POLICY IF EXISTS guards allow safe re-runs.

-- ─── estimates ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant estimates" ON estimates;
CREATE POLICY "Tenant members can select own tenant estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant estimates" ON estimates;
CREATE POLICY "Tenant members can insert own tenant estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── scans ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant scans" ON scans;
CREATE POLICY "Tenant members can select own tenant scans"
  ON scans FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant scans" ON scans;
CREATE POLICY "Tenant members can insert own tenant scans"
  ON scans FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── rate_library ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant rate_library" ON rate_library;
CREATE POLICY "Tenant members can select own tenant rate_library"
  ON rate_library FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant rate_library" ON rate_library;
CREATE POLICY "Tenant members can insert own tenant rate_library"
  ON rate_library FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── variations ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant variations" ON variations;
CREATE POLICY "Tenant members can select own tenant variations"
  ON variations FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant variations" ON variations;
CREATE POLICY "Tenant members can insert own tenant variations"
  ON variations FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── timesheets ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant timesheets" ON timesheets;
CREATE POLICY "Tenant members can select own tenant timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant timesheets" ON timesheets;
CREATE POLICY "Tenant members can insert own tenant timesheets"
  ON timesheets FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── milestone_claims ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tenant members can select own tenant milestone_claims" ON milestone_claims;
CREATE POLICY "Tenant members can select own tenant milestone_claims"
  ON milestone_claims FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant milestone_claims" ON milestone_claims;
CREATE POLICY "Tenant members can insert own tenant milestone_claims"
  ON milestone_claims FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── Seed: link test user to Vesh Electrical ─────────────────────────────────
--
-- No hardcoded test user UUID was found in the app codebase — auth is handled
-- entirely by Supabase Auth at runtime. If a specific test user needs to be
-- linked to Vesh Electrical, run the following manually in the SQL Editor,
-- replacing <TEST_USER_UUID> with the actual UUID from auth.users:
--
--   INSERT INTO tenant_memberships (tenant_id, user_id, role)
--   VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     '<TEST_USER_UUID>',
--     'owner'
--   )
--   ON CONFLICT (tenant_id, user_id) DO NOTHING;
