-- Adds tenant UPDATE/DELETE policies, then drops legacy owner-based policies.
DROP POLICY IF EXISTS "Tenant members can update own tenant milestone_claims" ON public.milestone_claims;
CREATE POLICY "Tenant members can update own tenant milestone_claims"
  ON public.milestone_claims FOR UPDATE TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
DROP POLICY IF EXISTS "Tenant members can delete own tenant milestone_claims" ON public.milestone_claims;
CREATE POLICY "Tenant members can delete own tenant milestone_claims"
  ON public.milestone_claims FOR DELETE TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
DROP POLICY IF EXISTS "milestone_claims owner select" ON public.milestone_claims;
DROP POLICY IF EXISTS "milestone_claims owner insert" ON public.milestone_claims;
DROP POLICY IF EXISTS "milestone_claims owner update" ON public.milestone_claims;
DROP POLICY IF EXISTS "milestone_claims owner delete" ON public.milestone_claims;
