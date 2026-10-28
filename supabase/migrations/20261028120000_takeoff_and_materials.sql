-- Takeoff verification gate and supplier materials requests.
-- Idempotent. Does not delete rows. Does not store supplier prices.
-- Apply in the Supabase SQL editor for project zxeznkuodpseijkvjwxa,
-- or with `npx supabase db push`, after this code is deployed.
-- The beta still reads and writes scans without this file.
-- Saving the verified-% setting and the materials status needs this file.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS verified_pct integer;

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  min_verified_pct integer,
  supplier_name text NOT NULL DEFAULT 'Lawrence & Hanson',
  supplier_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_min_verified_pct_range
    CHECK (min_verified_pct IS NULL OR (min_verified_pct >= 0 AND min_verified_pct <= 100))
);

CREATE TABLE IF NOT EXISTS public.materials_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  scan_id uuid,
  estimate_ref text,
  job_name text,
  site_address text,
  required_by date,
  supplier_name text NOT NULL DEFAULT 'Lawrence & Hanson',
  supplier_email text,
  notes text,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_requests_status_check
    CHECK (status IN ('draft', 'sent', 'priced', 'ordered', 'delivered'))
);

CREATE INDEX IF NOT EXISTS materials_requests_estimate_ref_idx
  ON public.materials_requests (estimate_ref);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_requests ENABLE ROW LEVEL SECURITY;

-- Service-role beta routes bypass row-level security.
-- Signed-in members can read and write only their own tenant once tenant_id is in use.
DROP POLICY IF EXISTS "Members read workspace settings" ON public.workspace_settings;
CREATE POLICY "Members read workspace settings"
  ON public.workspace_settings FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Members write workspace settings" ON public.workspace_settings;
CREATE POLICY "Members write workspace settings"
  ON public.workspace_settings FOR ALL TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Members read materials requests" ON public.materials_requests;
CREATE POLICY "Members read materials requests"
  ON public.materials_requests FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Members write materials requests" ON public.materials_requests;
CREATE POLICY "Members write materials requests"
  ON public.materials_requests FOR ALL TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.get_tenant_id());
