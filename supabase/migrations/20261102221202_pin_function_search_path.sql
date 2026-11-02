-- Pin search_path on the seven public functions the security advisor
-- flags as function_search_path_mutable, and stop anon from calling
-- public.get_tenant_id().
--
-- Idempotent. Does not change function bodies that already exist.
-- The three reference/updated_at helpers below were created in the
-- SQL editor and are not in an earlier migration file; they are
-- created here only when missing, using the current production body,
-- so a second apply neither rewrites them nor fails.
--
-- search_path is public, pg_temp. These functions call now()/to_char()
-- (pg_catalog, always searched) and, for the reference triggers,
-- unqualified estimates. public must stay first so that name resolves
-- to public.estimates. An empty search_path would break those triggers.
--
-- get_tenant_id() stays SECURITY DEFINER and keeps EXECUTE for
-- authenticated and service_role.
--   * authenticated: every tenant RLS policy is TO authenticated and
--     calls get_tenant_id() as the invoker. Signed-in code also calls
--     /rest/v1/rpc/get_tenant_id with the user JWT (lib/tenants.ts,
--     api/estimates/create.js).
--   * service_role: bypasses RLS (rolbypassrls). The open beta uses
--     this key from /api/beta/* and does not call the RPC. The grant
--     stays so a service-role RPC call still works after PUBLIC is
--     revoked.
--   * anon: no policy that applies to anon calls get_tenant_id().
--     Revoke the direct grant and the PUBLIC grant. PUBLIC is what
--     actually lets anon execute; revoking anon alone leaves the hole.
--     The open beta does not need it back. See the pull request.

-- ─── Legacy functions (production only, until this migration) ───────────────

DO $pin$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.update_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$
    $fn$;
  END IF;

  IF to_regprocedure('public.estimates_generate_reference()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.estimates_generate_reference()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $body$
      declare
        month_prefix text;
        seq int;
      begin
        if new.reference is not null and new.reference <> '' then
          return new;
        end if;
        month_prefix := to_char(coalesce(new.created_at, now()), 'YYMM');
        select coalesce(max(
          nullif(regexp_replace(reference, '^.*-', ''), '')::int
        ), 0) + 1
        into seq
        from estimates
        where owner_id = new.owner_id
          and reference like 'EST-' || month_prefix || '-%';
        new.reference := 'EST-' || month_prefix || '-' || lpad(seq::text, 4, '0');
        return new;
      end;
      $body$
    $fn$;
  END IF;

  IF to_regprocedure('public.generate_estimate_reference()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION public.generate_estimate_reference()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $body$
      DECLARE
        prefix TEXT;
        seq INT;
      BEGIN
        prefix := 'EST-' || TO_CHAR(NOW(), 'YYMM') || '-';
        SELECT COUNT(*) + 1 INTO seq
        FROM estimates
        WHERE reference LIKE prefix || '%';
        NEW.reference := prefix || LPAD(seq::TEXT, 4, '0');
        RETURN NEW;
      END;
      $body$
    $fn$;
  END IF;
END
$pin$;

-- ─── Pin search_path on all seven advisor findings ──────────────────────────
-- ALTER FUNCTION is idempotent: a second run sets the same value and
-- does not replace the body.

ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.estimates_generate_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.tenants_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_estimate_reference() SET search_path = public, pg_temp;
ALTER FUNCTION public.legend_library_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.variation_reports_touch_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.company_profile_touch_updated_at() SET search_path = public, pg_temp;

-- ─── get_tenant_id: anon can no longer call it ──────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_id() TO authenticated, service_role;
