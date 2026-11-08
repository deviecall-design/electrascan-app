-- Labour rate cards are visible only inside the caller's tenant.
-- A row with a null tenant is no longer readable or writable by authenticated users.

DROP POLICY IF EXISTS "Members read labour rates" ON public.labour_rate_cards;
CREATE POLICY "Members read labour rates"
  ON public.labour_rate_cards FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Members write labour rates" ON public.labour_rate_cards;
CREATE POLICY "Members write labour rates"
  ON public.labour_rate_cards FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = public.get_tenant_id());
