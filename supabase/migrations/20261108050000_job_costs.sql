-- Weekly job costs: timesheets, supplier invoices, and other costs.
-- Tenant is required. Rows with a null tenant are not readable.

CREATE TABLE IF NOT EXISTS public.job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_ref text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('timesheet', 'supplier', 'other')),
  spent_on date NOT NULL,
  hours numeric,
  role_name text,
  amount numeric NOT NULL DEFAULT 0,
  supplier text,
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read job costs" ON public.job_costs;
CREATE POLICY "Members read job costs"
  ON public.job_costs FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Members write job costs" ON public.job_costs;
CREATE POLICY "Members write job costs"
  ON public.job_costs FOR ALL TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());
