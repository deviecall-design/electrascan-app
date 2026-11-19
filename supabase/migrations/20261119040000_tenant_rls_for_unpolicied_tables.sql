-- Tenant SELECT policies for the eight public tables that have RLS enabled
-- and no policies (Supabase lint 0008_rls_enabled_no_policy):
--   assemblies, detection_corrections, supplier_price_links, draft_invoices,
--   job_records, job_actuals, job_schedules, contractor_price_lists.
--
-- Does not change login, AUTH_DISABLED, /api/beta, or /api/supplier.
-- Does not replace public.get_tenant_id() and does not change who can
-- execute it (authenticated and service_role only).
--
-- service_role has BYPASSRLS. The Vesh beta and the public supplier route
-- call PostgREST with that key, so they still read and write every row,
-- including a row whose tenant_id is null.
--
-- Every policy is TO authenticated. anon is not a policy role, so the anon
-- key still receives no rows. The predicate matches the closed hatch in
-- 20261108060000_labour_rate_cards_tenant_rls.sql: a null tenant_id does
-- not match, and get_tenant_id() is the caller's oldest membership.
--
-- Writes stay on the service role. This migration is the read path for a
-- connector that runs as the signed-in user. A write policy would let that
-- JWT mutate rows through PostgREST. Per table:
--   assemblies, contractor_price_lists, job_records, job_schedules,
--   job_actuals
--     The UI saves these through POST /api/beta/records. That route is
--     service role only, and it is refused when login is on. Opening
--     member writes now would let any signed-in JWT edit catalogues,
--     price files, and job totals before that path exists.
--   detection_corrections
--     Append-only review log. The takeoff posts a new row through the
--     beta route and never updates one. INSERT, UPDATE, and DELETE stay
--     service-role so a JWT cannot forge or rewrite the log.
--   draft_invoices
--     status includes 'pushed'. SELECT is enough for a read-only
--     connector. A JWT must not insert a pushed invoice or edit amounts.
--   supplier_price_links
--     token is the credential for /api/supplier/:token, which uses the
--     service role and checks the token shape. No INSERT, UPDATE, or
--     DELETE policy, so a JWT cannot mint a token or overwrite a price.
--     SELECT still returns token for the owning tenant. Row policies
--     cannot hide that column; see the pull request.
--
-- Idempotent. Adds no rows and does not rewrite existing ones.
-- tenant_id indexes support the policy predicate. None of these tables
-- had one.

ALTER TABLE public.assemblies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read assemblies" ON public.assemblies;
CREATE POLICY "Members read assemblies"
  ON public.assemblies
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_assemblies_tenant_id
  ON public.assemblies (tenant_id);

ALTER TABLE public.detection_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read detection corrections" ON public.detection_corrections;
CREATE POLICY "Members read detection corrections"
  ON public.detection_corrections
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_detection_corrections_tenant_id
  ON public.detection_corrections (tenant_id);

ALTER TABLE public.supplier_price_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read supplier price links" ON public.supplier_price_links;
CREATE POLICY "Members read supplier price links"
  ON public.supplier_price_links
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_supplier_price_links_tenant_id
  ON public.supplier_price_links (tenant_id);

ALTER TABLE public.draft_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read draft invoices" ON public.draft_invoices;
CREATE POLICY "Members read draft invoices"
  ON public.draft_invoices
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_draft_invoices_tenant_id
  ON public.draft_invoices (tenant_id);

ALTER TABLE public.job_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read job records" ON public.job_records;
CREATE POLICY "Members read job records"
  ON public.job_records
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_job_records_tenant_id
  ON public.job_records (tenant_id);

ALTER TABLE public.job_actuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read job actuals" ON public.job_actuals;
CREATE POLICY "Members read job actuals"
  ON public.job_actuals
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_job_actuals_tenant_id
  ON public.job_actuals (tenant_id);

ALTER TABLE public.job_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read job schedules" ON public.job_schedules;
CREATE POLICY "Members read job schedules"
  ON public.job_schedules
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_job_schedules_tenant_id
  ON public.job_schedules (tenant_id);

ALTER TABLE public.contractor_price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read contractor price lists" ON public.contractor_price_lists;
CREATE POLICY "Members read contractor price lists"
  ON public.contractor_price_lists
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
CREATE INDEX IF NOT EXISTS idx_contractor_price_lists_tenant_id
  ON public.contractor_price_lists (tenant_id);
