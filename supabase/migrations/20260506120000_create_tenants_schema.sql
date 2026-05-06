-- ElectraScan — tenants + tenant_memberships schema
--
-- Introduces a proper multi-tenant model:
--   1. tenants            — one row per contractor company (Vesh Electrical, etc.)
--   2. tenant_memberships — links auth.users to tenants with an owner/member role
--   3. tenant_id FK       — added (nullable) to all core tables so every row can
--                           be scoped to a tenant without breaking existing data
--   4. auth.tenant_id()   — helper returning the caller's tenant from membership
--
-- Idempotent: safe to run multiple times on the same database.
-- Run after all 001–005 migrations.

-- ─── 1. TENANTS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,           -- trading name e.g. "Vesh Electrical Services"
  abn           TEXT,
  address       TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  email_reply_to TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE tenants IS
  'One row per contractor company. White-label source of truth for branding, ABN, and contact details on every PDF/email. Linked to auth.users via tenant_memberships.';

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see all tenants — they join via memberships.
-- Owner-level INSERT/UPDATE is enforced through the memberships table.
DROP POLICY IF EXISTS "Authenticated users can view tenants" ON tenants;
CREATE POLICY "Authenticated users can view tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (true);

-- Only a tenant owner (verified via membership) may insert a new tenant row.
DROP POLICY IF EXISTS "Tenant owners can insert tenants" ON tenants;
CREATE POLICY "Tenant owners can insert tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenants.id
        AND tenant_memberships.user_id   = auth.uid()
        AND tenant_memberships.role      = 'owner'
    )
  );

-- Only a tenant owner may update their tenant row.
DROP POLICY IF EXISTS "Tenant owners can update tenants" ON tenants;
CREATE POLICY "Tenant owners can update tenants"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenants.id
        AND tenant_memberships.user_id   = auth.uid()
        AND tenant_memberships.role      = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE tenant_memberships.tenant_id = tenants.id
        AND tenant_memberships.user_id   = auth.uid()
        AND tenant_memberships.role      = 'owner'
    )
  );

-- ─── updated_at trigger for tenants ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION tenants_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_touch_updated_at_trigger ON tenants;
CREATE TRIGGER tenants_touch_updated_at_trigger
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION tenants_touch_updated_at();

-- ─── 2. TENANT_MEMBERSHIPS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

COMMENT ON TABLE tenant_memberships IS
  'Links auth.users to tenants. Role "owner" grants full admin; "member" is a standard collaborator. A user may belong to multiple tenants but auth.tenant_id() returns the first matched row.';

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id
  ON tenant_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id
  ON tenant_memberships (tenant_id);

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Users can see their own membership rows.
DROP POLICY IF EXISTS "Users can view own memberships" ON tenant_memberships;
CREATE POLICY "Users can view own memberships"
  ON tenant_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tenant owners can manage (INSERT/UPDATE/DELETE) memberships for their tenants.
DROP POLICY IF EXISTS "Tenant owners can insert memberships" ON tenant_memberships;
CREATE POLICY "Tenant owners can insert memberships"
  ON tenant_memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_memberships AS m
      WHERE m.tenant_id = tenant_memberships.tenant_id
        AND m.user_id   = auth.uid()
        AND m.role      = 'owner'
    )
  );

DROP POLICY IF EXISTS "Tenant owners can update memberships" ON tenant_memberships;
CREATE POLICY "Tenant owners can update memberships"
  ON tenant_memberships FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships AS m
      WHERE m.tenant_id = tenant_memberships.tenant_id
        AND m.user_id   = auth.uid()
        AND m.role      = 'owner'
    )
  );

DROP POLICY IF EXISTS "Tenant owners can delete memberships" ON tenant_memberships;
CREATE POLICY "Tenant owners can delete memberships"
  ON tenant_memberships FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships AS m
      WHERE m.tenant_id = tenant_memberships.tenant_id
        AND m.user_id   = auth.uid()
        AND m.role      = 'owner'
    )
  );

-- ─── 3. ADD tenant_id TO CORE TABLES ─────────────────────────────────────────
-- Nullable FK so existing rows remain valid. Set after data migration or
-- via app logic as tenants are assigned.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE rate_library
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE variations
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

ALTER TABLE milestone_claims
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Indexes for tenant-scoped queries on the most-queried tables.
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_id   ON estimates   (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scans_tenant_id       ON scans       (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_library_tenant_id ON rate_library (tenant_id);

-- ─── 4. HELPER FUNCTION — auth.tenant_id() ───────────────────────────────────
-- Returns the tenant_id for the currently authenticated user.
-- Returns NULL if the user has no membership (e.g. during onboarding).
-- STABLE: safe to call repeatedly within a query without re-evaluation.

CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id
  FROM tenant_memberships
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION auth.tenant_id() IS
  'Returns the tenant_id of the first membership for the currently authenticated user, or NULL if none exists. Use in RLS policies to scope rows to a tenant.';

-- ─── 5. SEED — Vesh Electrical ───────────────────────────────────────────────
-- Fixed UUID for idempotency: re-running this migration does not duplicate the row.

INSERT INTO tenants (id, name, abn, contact_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Vesh Electrical Services',
  '',
  'admin@vesh.com.au'
)
ON CONFLICT (id) DO NOTHING;
