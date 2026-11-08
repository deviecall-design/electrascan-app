-- Align milestone_claims with the columns the app reads.
-- Additive. Does not delete claims. Authenticated access requires a tenant.

ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS milestone_id text;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS milestone_label text;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS inv_ref text;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.milestone_claims ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.milestone_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can select own tenant milestone_claims" ON public.milestone_claims;
CREATE POLICY "Tenant members can select own tenant milestone_claims"
  ON public.milestone_claims FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can insert own tenant milestone_claims" ON public.milestone_claims;
CREATE POLICY "Tenant members can insert own tenant milestone_claims"
  ON public.milestone_claims FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
