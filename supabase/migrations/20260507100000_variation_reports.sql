-- ElectraScan — variation_reports table
--
-- Stores the summarised output of a variation assessment.
-- Internal-only document: never sent to builders.
-- tenant_id is required on insert; RLS enforced via public.get_tenant_id().
--
-- Depends on: 20260506120000_create_tenants_schema.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS variation_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id),
  owner_id              UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  project_name          TEXT NOT NULL,
  base_estimate_number  TEXT NOT NULL,
  base_total            NUMERIC NOT NULL DEFAULT 0,
  new_total             NUMERIC NOT NULL DEFAULT 0,
  delta                 NUMERIC NOT NULL DEFAULT 0,
  pct_change            NUMERIC NOT NULL DEFAULT 0,
  variation_items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'approved', 'superseded')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE variation_reports IS
  'Internal variation assessment summaries. Never distributed externally — used to inform revised estimates. One row per variation event.';

CREATE INDEX IF NOT EXISTS idx_variation_reports_tenant_id ON variation_reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_variation_reports_owner_id  ON variation_reports (owner_id);

ALTER TABLE variation_reports ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION variation_reports_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS variation_reports_touch_updated_at_trigger ON variation_reports;
CREATE TRIGGER variation_reports_touch_updated_at_trigger
  BEFORE UPDATE ON variation_reports
  FOR EACH ROW
  EXECUTE FUNCTION variation_reports_touch_updated_at();

-- RLS policies
DROP POLICY IF EXISTS "Tenant members can select own tenant variation_reports" ON variation_reports;
CREATE POLICY "Tenant members can select own tenant variation_reports"
  ON variation_reports FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS "Tenant members can insert own tenant variation_reports" ON variation_reports;
CREATE POLICY "Tenant members can insert own tenant variation_reports"
  ON variation_reports FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can update own tenant variation_reports" ON variation_reports;
CREATE POLICY "Tenant members can update own tenant variation_reports"
  ON variation_reports FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());
