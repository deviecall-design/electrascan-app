-- ElectraScan — company_profile table
--
-- One row per tenant; powers white-label branding on every estimate/variation PDF.
-- Matches the schema from migrations/005_company_profile.sql, promoted to the
-- supabase/migrations/ path for CLI-managed deployment.
--
-- Depends on: (none — standalone table keyed to auth.users)
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS company_profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  company_name  TEXT NOT NULL,
  abn           TEXT,
  logo_url      TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (owner_id)
);

COMMENT ON TABLE company_profile IS
  'Tenant company profile. One row per owner; sender identity on branded estimates, variations and emails.';

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION company_profile_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_profile_touch_updated_at_trigger ON company_profile;
CREATE TRIGGER company_profile_touch_updated_at_trigger
  BEFORE UPDATE ON company_profile
  FOR EACH ROW
  EXECUTE FUNCTION company_profile_touch_updated_at();

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own company profile"   ON company_profile;
DROP POLICY IF EXISTS "Users insert own company profile" ON company_profile;
DROP POLICY IF EXISTS "Users update own company profile" ON company_profile;

CREATE POLICY "Users read own company profile"
  ON company_profile FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users insert own company profile"
  ON company_profile FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own company profile"
  ON company_profile FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
