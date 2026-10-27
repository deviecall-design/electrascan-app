-- ElectraScan — invite allowlist. Vesh is not the default workspace.
--
-- ensure_beta_membership() attached every signed-in user to Vesh Electrical
-- as owner. That is removed here.
--
-- Access rules, in order:
--   1. A user who already has a membership keeps it. This function never
--      moves them and never adds a second tenant.
--   2. An email on tenant_invites joins that tenant with the role on the
--      row. The role is not defaulted to owner.
--   3. Anyone else gets a new tenant that they alone own. A clearly
--      fictional DEMO scan and quote are copied into THAT tenant so a
--      showcase is not empty. Those rows are not shared with Vesh or with
--      any other visitor.
--
-- A shared "Demo" tenant was rejected: every Lawrence & Hanson login would
-- then read every other visitor's uploads.
--
-- The owner adds Vesh staff in Settings, or with the SQL at the bottom of
-- this file. Apply this migration before the showcase.
--
-- Idempotent.

DROP FUNCTION IF EXISTS public.ensure_beta_membership();

-- Oldest membership wins when a user has more than one. Deterministic,
-- and it does not invent Vesh when the user has none.
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tenant_id
  FROM public.tenant_memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_tenant_id() IS
  'Tenant of the caller''s oldest membership, or NULL. Never defaults to Vesh.';

-- ─── Allowlist ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invites_email_key UNIQUE (email)
);

COMMENT ON TABLE public.tenant_invites IS
  'Emails allowed to join a tenant. Role is taken from this row. Unlisted emails do not join Vesh.';

CREATE OR REPLACE FUNCTION public.tenant_invites_normalize()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.role IS NULL OR NEW.role NOT IN ('owner', 'member') THEN
    NEW.role := 'member';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_invites_normalize ON public.tenant_invites;
CREATE TRIGGER tenant_invites_normalize
  BEFORE INSERT OR UPDATE ON public.tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.tenant_invites_normalize();

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage tenant invites" ON public.tenant_invites;
CREATE POLICY "Owners manage tenant invites"
  ON public.tenant_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships AS m
      WHERE m.tenant_id = tenant_invites.tenant_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  )
  WITH CHECK (
    role IN ('owner', 'member')
    AND tenant_id = public.get_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships AS m
      WHERE m.tenant_id = tenant_invites.tenant_id
        AND m.user_id = auth.uid()
        AND m.role = 'owner'
    )
  );

-- ─── Provision ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provision_workspace()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid UUID := auth.uid();
  existing UUID;
  user_email TEXT;
  invited_tenant UUID;
  invited_role TEXT;
  new_tenant UUID;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT tenant_id INTO existing
  FROM public.tenant_memberships
  WHERE user_id = uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT lower(btrim(email)) INTO user_email
  FROM auth.users
  WHERE id = uid;

  IF user_email IS NOT NULL AND user_email <> '' THEN
    SELECT tenant_id, role
      INTO invited_tenant, invited_role
    FROM public.tenant_invites
    WHERE email = user_email
    LIMIT 1;
  END IF;

  IF invited_tenant IS NOT NULL THEN
    IF invited_role NOT IN ('owner', 'member') THEN
      invited_role := 'member';
    END IF;

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (invited_tenant, uid, invited_role)
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

    RETURN invited_tenant;
  END IF;

  INSERT INTO public.tenants (name, contact_email)
  VALUES ('Showcase workspace', NULLIF(user_email, ''))
  RETURNING id INTO new_tenant;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (new_tenant, uid, 'owner');

  -- Fictional rows for this workspace only. A failure here must not
  -- leave the user without a tenant, and must not write into Vesh.
  BEGIN
    INSERT INTO public.scans (
      file_name, client, stage, items_detected, progress,
      tenant_id, owner_id, detected_items
    ) VALUES (
      'DEMO — Northbridge plan.pdf',
      'Harbour & Co (demo)',
      'review',
      1,
      55,
      new_tenant,
      uid,
      '[{"id":1,"symbol":"GPO","qty":4,"desc":"DEMO double GPO","rateCode":"GPO-D","conf":0.91,"x":0,"y":0,"unitPrice":120}]'::jsonb
    );

    INSERT INTO public.estimates (
      ref, reference, client, value, status, project_name,
      subtotal, margin_pct, tenant_id, owner_id, line_items
    ) VALUES (
      'DEMO-0001',
      'DEMO-0001',
      'Harbour & Co (demo)',
      14080,
      'draft',
      'DEMO — Northbridge apartment',
      12800,
      10,
      new_tenant,
      uid,
      '[{"desc":"DEMO double GPO","qty":4,"rateCode":"GPO-D"}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN new_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_workspace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_workspace() TO authenticated;

COMMENT ON FUNCTION public.provision_workspace() IS
  'Join the invited tenant with the invited role, or create a private showcase workspace. Never defaults to Vesh.';

-- ─── Stamp tenant_id from the membership, ignoring the payload ──────────────

CREATE OR REPLACE FUNCTION public.stamp_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tid UUID;
BEGIN
  tid := public.get_tenant_id();
  IF tid IS NULL THEN
    RAISE EXCEPTION 'no tenant membership for this account';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.tenant_id := tid;
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

-- Owner-scoped policies are OR'd with the tenant policies, so a caller
-- could insert their own owner_id and Vesh's tenant_id. Drop that hole.
DROP POLICY IF EXISTS "Users read own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users insert own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users update own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users read own scans" ON public.scans;
DROP POLICY IF EXISTS "Users insert own scans" ON public.scans;
DROP POLICY IF EXISTS "Users update own scans" ON public.scans;
DROP POLICY IF EXISTS "Users read own rates" ON public.rate_library;
DROP POLICY IF EXISTS "Users insert own rates" ON public.rate_library;
DROP POLICY IF EXISTS "Users update own rates" ON public.rate_library;

DROP POLICY IF EXISTS "Authenticated users can view tenants" ON public.tenants;
DROP POLICY IF EXISTS "Members can view their tenant" ON public.tenants;
CREATE POLICY "Members can view their tenant"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships AS m
      WHERE m.tenant_id = tenants.id
        AND m.user_id = auth.uid()
    )
  );

-- Recreate write policies so WITH CHECK matches the stamp.
DROP POLICY IF EXISTS "Tenant members can insert own tenant estimates" ON public.estimates;
CREATE POLICY "Tenant members can insert own tenant estimates"
  ON public.estimates FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can update own tenant estimates" ON public.estimates;
CREATE POLICY "Tenant members can update own tenant estimates"
  ON public.estimates FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can insert own tenant scans" ON public.scans;
CREATE POLICY "Tenant members can insert own tenant scans"
  ON public.scans FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can update own tenant scans" ON public.scans;
CREATE POLICY "Tenant members can update own tenant scans"
  ON public.scans FOR UPDATE TO authenticated
  USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can select own tenant approval_audit" ON public.approval_audit;
CREATE POLICY "Tenant members can select own tenant approval_audit"
  ON public.approval_audit FOR SELECT TO authenticated
  USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS "Tenant members can insert own tenant approval_audit" ON public.approval_audit;
CREATE POLICY "Tenant members can insert own tenant approval_audit"
  ON public.approval_audit FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_tenant_id());

-- Attach the stamp where the table exists. Missing optional tables are skipped.
DO $$
DECLARE
  target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'estimates',
    'scans',
    'rate_library',
    'variations',
    'timesheets',
    'milestone_claims',
    'approval_audit',
    'variation_reports'
  ]
  LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', target || '_stamp_tenant', target);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_id()',
      target || '_stamp_tenant',
      target
    );
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target);
  END LOOP;
END;
$$;

ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invites TO authenticated;

-- ─── How the owner adds a Vesh user ──────────────────────────────────────────
-- Run in the Supabase SQL editor. Role is 'member' unless this person should
-- manage invites. Do not insert a Lawrence & Hanson email here.
--
--   INSERT INTO public.tenant_invites (email, tenant_id, role)
--   VALUES (
--     'name@veshelectrical.com.au',
--     '00000000-0000-0000-0000-000000000001',
--     'member'
--   )
--   ON CONFLICT (email) DO UPDATE
--     SET tenant_id = EXCLUDED.tenant_id,
--         role = EXCLUDED.role;
--
-- If ensure_beta_membership() already ran, review who landed in Vesh and
-- remove anyone who is not staff:
--
--   SELECT u.email, m.role, m.user_id
--   FROM public.tenant_memberships m
--   JOIN auth.users u ON u.id = m.user_id
--   WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001';
--
--   DELETE FROM public.tenant_memberships
--   WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
--     AND user_id = '<user uuid>';
