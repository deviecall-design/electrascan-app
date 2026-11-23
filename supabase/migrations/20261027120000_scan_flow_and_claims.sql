-- ElectraScan — make the upload → scan → claim path persist.
--
-- 1. scans UPDATE policy for tenant members (insert/select already exist).
-- 2. milestone_claims table, matching the columns the app inserts.
--    A failed insert must be a real error so the UI does not advance a claim.
-- 3. approval_audit so a DocuSign send can be recorded against an estimate.
--
-- Live note: milestone_claims and approval_audit already exist in production
-- with an older shape (project_name / milestone / claimed_at, and no tenant_id
-- on approval_audit). CREATE TABLE IF NOT EXISTS is a no-op there, so the new
-- columns are added explicitly and old values are copied across. Old columns
-- are kept; nothing is dropped or deleted.
--
-- Workspace access is NOT granted here. Do not attach every signed-in user
-- to Vesh Electrical. That lives in 20261027143000_tenant_invites.sql.
--
-- Idempotent.

DROP FUNCTION IF EXISTS public.ensure_beta_membership();

-- ─── scans: tenant members can update their own rows ────────────────────────

DROP POLICY IF EXISTS "Tenant members can update own tenant scans" ON scans;
CREATE POLICY "Tenant members can update own tenant scans"
  ON scans FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── milestone_claims ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       TEXT NOT NULL,
  milestone_id     TEXT NOT NULL,
  milestone_label  TEXT,
  amount           NUMERIC NOT NULL DEFAULT 0,
  inv_ref          TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  owner_id         UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  tenant_id        UUID REFERENCES tenants(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS milestone_id TEXT;
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS milestone_label TEXT;
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS inv_ref TEXT;
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE milestone_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Existing tables keep their old defaults; give them the intended ones.
ALTER TABLE milestone_claims ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE milestone_claims ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE milestone_claims ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- Reconcile older rows (legacy shape) into the new columns. Old columns stay.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'milestone_claims'
               AND column_name = 'project_name') THEN
    EXECUTE 'UPDATE milestone_claims SET project_id = project_name
             WHERE project_id IS NULL AND project_name IS NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'milestone_claims'
               AND column_name = 'milestone') THEN
    EXECUTE 'UPDATE milestone_claims
             SET milestone_label = COALESCE(milestone_label, milestone),
                 milestone_id    = COALESCE(milestone_id, milestone)
             WHERE milestone IS NOT NULL
               AND (milestone_label IS NULL OR milestone_id IS NULL)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'milestone_claims'
               AND column_name = 'claimed_at') THEN
    EXECUTE 'UPDATE milestone_claims SET created_at = claimed_at
             WHERE claimed_at IS NOT NULL AND created_at IS DISTINCT FROM claimed_at
               AND created_at >= claimed_at';
  END IF;
END $$;

ALTER TABLE milestone_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can select own tenant milestone_claims" ON milestone_claims;
CREATE POLICY "Tenant members can select own tenant milestone_claims"
  ON milestone_claims FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can insert own tenant milestone_claims" ON milestone_claims;
CREATE POLICY "Tenant members can insert own tenant milestone_claims"
  ON milestone_claims FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── approval_audit ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id   TEXT,
  estimate_ref  TEXT,
  signer_email  TEXT,
  action        TEXT,
  actor         TEXT,
  owner_id      UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  tenant_id     UUID REFERENCES tenants(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Live table predates this file; add the columns the policies and app need.
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS envelope_id TEXT;
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS estimate_ref TEXT;
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS actor TEXT;
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE approval_audit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE approval_audit ALTER COLUMN owner_id SET DEFAULT auth.uid();

ALTER TABLE approval_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can select own tenant approval_audit" ON approval_audit;
CREATE POLICY "Tenant members can select own tenant approval_audit"
  ON approval_audit FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Tenant members can insert own tenant approval_audit" ON approval_audit;
CREATE POLICY "Tenant members can insert own tenant approval_audit"
  ON approval_audit FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id() OR owner_id = auth.uid());
