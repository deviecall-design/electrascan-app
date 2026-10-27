/**
 * RLS isolation for Vesh vs an uninvited showcase login.
 *
 * Runs the tenant-invite migration against an embedded Postgres and checks
 * the policies the way Postgres applies them: permissive policies are OR'd,
 * so the old "owner_id = auth.uid()" policies are created first and the
 * migration must close that hole.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const VESH = "00000000-0000-0000-0000-000000000001";
const VESH_USER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const VISITOR = "33333333-3333-4333-8333-333333333333";
const KEEPER = "44444444-4444-4444-8444-444444444444";

const root = dirname(fileURLToPath(import.meta.url));

let db: PGlite;

async function asUser<T extends Record<string, unknown>>(userId: string, sql: string) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec("SET ROLE authenticated");
  try {
    return await db.query<T>(sql);
  } finally {
    await db.exec("RESET ROLE");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY,
      email TEXT
    );
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOINHERIT;
      END IF;
    END $$;

    CREATE TABLE public.tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      abn TEXT,
      address TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      email_reply_to TEXT,
      logo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Authenticated users can view tenants"
      ON public.tenants FOR SELECT TO authenticated USING (true);

    CREATE TABLE public.tenant_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (tenant_id, user_id)
    );
    ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view own memberships"
      ON public.tenant_memberships FOR SELECT TO authenticated
      USING (user_id = auth.uid());

    CREATE OR REPLACE FUNCTION public.get_tenant_id()
    RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid() LIMIT 1;
    $$;

    CREATE TABLE public.estimates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ref TEXT NOT NULL,
      reference TEXT,
      client TEXT NOT NULL,
      value NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      project_name TEXT,
      subtotal NUMERIC DEFAULT 0,
      margin_pct NUMERIC DEFAULT 15,
      line_items JSONB DEFAULT '[]'::jsonb,
      owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
      tenant_id UUID REFERENCES public.tenants(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users read own estimates" ON public.estimates FOR SELECT USING (owner_id = auth.uid());
    CREATE POLICY "Users insert own estimates" ON public.estimates FOR INSERT WITH CHECK (owner_id = auth.uid());
    CREATE POLICY "Users update own estimates" ON public.estimates FOR UPDATE USING (owner_id = auth.uid());
    CREATE POLICY "Tenant members can select own tenant estimates"
      ON public.estimates FOR SELECT TO authenticated
      USING (tenant_id = public.get_tenant_id());

    CREATE TABLE public.scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name TEXT NOT NULL,
      client TEXT,
      stage TEXT,
      items_detected INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      detected_items JSONB DEFAULT '[]'::jsonb,
      owner_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
      tenant_id UUID REFERENCES public.tenants(id)
    );
    ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users read own scans" ON public.scans FOR SELECT USING (owner_id = auth.uid());
    CREATE POLICY "Users insert own scans" ON public.scans FOR INSERT WITH CHECK (owner_id = auth.uid());
    CREATE POLICY "Tenant members can select own tenant scans"
      ON public.scans FOR SELECT TO authenticated
      USING (tenant_id = public.get_tenant_id());

    CREATE TABLE public.rate_library (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID
    );
    CREATE TABLE public.variations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID);
    CREATE TABLE public.timesheets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID);
    CREATE TABLE public.milestone_claims (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID);
    CREATE TABLE public.approval_audit (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID, owner_id UUID);
    CREATE TABLE public.variation_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID);

    INSERT INTO auth.users (id, email) VALUES
      ('${VESH_USER}', 'owner@vesh.example'),
      ('${MEMBER}', 'Member@Vesh.example'),
      ('${VISITOR}', 'guest@lawrence.example'),
      ('${KEEPER}', 'already@elsewhere.example');

    INSERT INTO public.tenants (id, name, contact_email)
    VALUES ('${VESH}', 'Vesh Electrical Services', 'admin@vesh.example');

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES ('${VESH}', '${VESH_USER}', 'owner');

    INSERT INTO public.estimates (ref, client, value, status, tenant_id, owner_id, project_name)
    VALUES ('EST-VESH-1', 'Real Vesh client', 50000, 'sent', '${VESH}', '${VESH_USER}', 'Vesh switchboard upgrade');

    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  `);

  const migration = readFileSync(
    join(root, "../supabase/migrations/20261027143000_tenant_invites.sql"),
    "utf8",
  );
  await db.exec(migration);

  await db.exec(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invites TO authenticated;
    GRANT EXECUTE ON FUNCTION public.provision_workspace() TO authenticated;
  `);
}, 30000);

afterAll(async () => {
  await db?.close();
});

describe.sequential("tenant invite RLS", () => {
  it("lets an invited email join Vesh as member, not owner", async () => {
    await db.exec(`
      INSERT INTO public.tenant_invites (email, tenant_id, role)
      VALUES ('member@vesh.example', '${VESH}', 'member');
    `);

    const joined = await asUser<{ provision_workspace: string }>(
      MEMBER,
      "SELECT public.provision_workspace()",
    );
    expect(joined.rows[0].provision_workspace).toBe(VESH);

    const membership = await db.query<{ role: string; tenant_id: string }>(
      `SELECT role, tenant_id::text FROM public.tenant_memberships WHERE user_id = '${MEMBER}'`,
    );
    expect(membership.rows).toEqual([{ role: "member", tenant_id: VESH }]);

    const veshJobs = await asUser<{ client: string }>(
      MEMBER,
      "SELECT client FROM public.estimates ORDER BY client",
    );
    expect(veshJobs.rows.map(row => row.client)).toContain("Real Vesh client");
    expect(veshJobs.rows.map(row => row.client)).not.toContain("Harbour & Co (demo)");
  });

  it("gives an unlisted email a private workspace and hides Vesh", async () => {
    const joined = await asUser<{ provision_workspace: string }>(
      VISITOR,
      "SELECT public.provision_workspace()",
    );
    const visitorTenant = joined.rows[0].provision_workspace;
    expect(visitorTenant).not.toBe(VESH);

    const membership = await db.query<{ role: string }>(
      `SELECT role FROM public.tenant_memberships WHERE user_id = '${VISITOR}'`,
    );
    expect(membership.rows[0].role).toBe("owner");

    const asVisitor = await asUser<{ client: string; tenant_id: string }>(
      VISITOR,
      "SELECT client, tenant_id::text FROM public.estimates ORDER BY client",
    );
    expect(asVisitor.rows.map(row => row.client)).toEqual(["Harbour & Co (demo)"]);
    expect(asVisitor.rows[0].tenant_id).toBe(visitorTenant);
    expect(asVisitor.rows.some(row => row.client === "Real Vesh client")).toBe(false);

    const asVesh = await asUser<{ client: string }>(
      VESH_USER,
      "SELECT client FROM public.estimates ORDER BY client",
    );
    expect(asVesh.rows.map(row => row.client)).toEqual(["Real Vesh client"]);

    const veshTenants = await asUser<{ id: string }>(
      VISITOR,
      "SELECT id::text FROM public.tenants",
    );
    expect(veshTenants.rows.map(row => row.id)).not.toContain(VESH);

    const scans = await asUser<{ file_name: string }>(
      VISITOR,
      "SELECT file_name FROM public.scans",
    );
    expect(scans.rows.map(row => row.file_name)).toEqual(["DEMO — Northbridge plan.pdf"]);

    const veshScans = await asUser<{ file_name: string }>(
      VESH_USER,
      "SELECT file_name FROM public.scans",
    );
    expect(veshScans.rows).toEqual([]);
  });

  it("rewrites an insert that tries to land in Vesh", async () => {
    await asUser(
      VISITOR,
      `INSERT INTO public.estimates (ref, client, value, tenant_id, owner_id)
       VALUES ('INJECT-1', 'Injected into Vesh', 1, '${VESH}', '${VISITOR}')`,
    );

    const stored = await db.query<{ tenant_id: string }>(
      `SELECT tenant_id::text FROM public.estimates WHERE ref = 'INJECT-1'`,
    );
    expect(stored.rows[0].tenant_id).not.toBe(VESH);

    const seenByVesh = await asUser<{ ref: string }>(
      VESH_USER,
      "SELECT ref FROM public.estimates WHERE ref = 'INJECT-1'",
    );
    expect(seenByVesh.rows).toEqual([]);
  });

  it("stops a member adding someone to Vesh, and lets the owner", async () => {
    await expect(
      asUser(
        MEMBER,
        `INSERT INTO public.tenant_invites (email, tenant_id, role)
         VALUES ('extra@lawrence.example', '${VESH}', 'owner')`,
      ),
    ).rejects.toThrow();

    await asUser(
      VESH_USER,
      `INSERT INTO public.tenant_invites (email, tenant_id, role)
       VALUES ('staff@vesh.example', '${VESH}', 'member')`,
    );
    const saved = await db.query<{ email: string; role: string }>(
      `SELECT email, role FROM public.tenant_invites WHERE email = 'staff@vesh.example'`,
    );
    expect(saved.rows).toEqual([{ email: "staff@vesh.example", role: "member" }]);
  });

  it("does not move a user who already belongs to another tenant", async () => {
    const own = "55555555-5555-4555-8555-555555555555";
    await db.exec(`
      INSERT INTO public.tenants (id, name) VALUES ('${own}', 'Already elsewhere');
      INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
      VALUES ('${own}', '${KEEPER}', 'owner');
    `);

    const joined = await asUser<{ provision_workspace: string }>(
      KEEPER,
      "SELECT public.provision_workspace()",
    );
    expect(joined.rows[0].provision_workspace).toBe(own);

    const veshRows = await db.query(
      `SELECT 1 FROM public.tenant_memberships
       WHERE user_id = '${KEEPER}' AND tenant_id = '${VESH}'`,
    );
    expect(veshRows.rows).toEqual([]);
  });
});
