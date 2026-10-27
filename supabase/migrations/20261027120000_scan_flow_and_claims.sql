-- ElectraScan — make the upload → scan → claim path persist.
--
-- 1. ensure_beta_membership()
--    The beta tenant (Vesh Electrical) is seeded, but a signed-in user with
--    no tenant_memberships row fails every RLS check (get_tenant_id() is
--    null). This function attaches the current user to Vesh only when they
--    have no membership yet. It is a POC unblock: remove it before public
--    signup, or every new account becomes a Vesh owner.
--
-- 2. scans UPDATE policy for tenant members (insert/select already exist).
--
-- 3. milestone_claims table, matching the columns the app inserts.
--    A failed insert must be a real error so the UI does not advance a claim.
--
-- 4. approval_audit so a DocuSign send can be recorded against an estimate.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.ensure_beta_membership()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing UUID;
  beta UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT tenant_id INTO existing
  FROM public.tenant_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.tenants (id, name, abn, contact_email)
  VALUES (beta, 'Vesh Electrical Services', '', 'admin@vesh.com.au')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (beta, auth.uid(), 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN beta;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_beta_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_beta_membership() TO authenticated;

COMMENT ON FUNCTION public.ensure_beta_membership() IS
  'POC: attach a signed-in user with no tenant to Vesh Electrical. Remove before public signup.';

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
