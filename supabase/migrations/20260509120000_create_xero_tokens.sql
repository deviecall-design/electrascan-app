-- xero_tokens: stores OAuth 2.0 credentials for each org's Xero connection.
--
-- One row per (org_id, xero_tenant_id) pair. A contractor may authorise
-- multiple Xero organisations under one ElectraScan org (unusual, but the
-- schema handles it). The UNIQUE constraint enforces that and is also what
-- drives the ON CONFLICT upsert in api/xero/callback.js.
--
-- Token lifetimes:
--   access_token  — 30 minutes (1800s). Refresh before any Xero API call
--                   when NOW() >= token_expiry.
--   refresh_token — 60 days. After expiry the user must re-authenticate.
--
-- org_id references the authenticated user's identity via auth.users(id).
-- If you later add a dedicated `tenants` table, re-point the FK there.

CREATE TABLE IF NOT EXISTS xero_tokens (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xero_tenant_id    TEXT        NOT NULL,     -- Xero's tenantId GUID (string form)
  xero_tenant_name  TEXT,                     -- denormalised for display (e.g. "Vesh Electrical")
  access_token      TEXT        NOT NULL,
  refresh_token     TEXT        NOT NULL,
  token_expiry      TIMESTAMPTZ NOT NULL,     -- UTC datetime when the access_token expires
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active connection per (org, xero tenant).
  CONSTRAINT xero_tokens_org_tenant_uniq UNIQUE (org_id, xero_tenant_id)
);

-- RLS: users can only read/write their own token rows.
ALTER TABLE xero_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own xero tokens" ON xero_tokens;
CREATE POLICY "Users manage own xero tokens"
  ON xero_tokens FOR ALL
  USING (auth.uid() = org_id)
  WITH CHECK (auth.uid() = org_id);

-- Fast lookup when checking whether a connection exists for a given org.
CREATE INDEX IF NOT EXISTS xero_tokens_org_idx
  ON xero_tokens(org_id);

-- Keep updated_at current on every upsert / refresh.
CREATE OR REPLACE FUNCTION xero_tokens_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS xero_tokens_set_updated_at ON xero_tokens;
CREATE TRIGGER xero_tokens_set_updated_at
  BEFORE UPDATE ON xero_tokens
  FOR EACH ROW
  EXECUTE FUNCTION xero_tokens_touch_updated_at();

COMMENT ON TABLE xero_tokens IS
  'Per-org Xero OAuth 2.0 tokens. One row per (org_id, xero_tenant_id). Upserted by api/xero/callback.js on each successful authorisation.';

COMMENT ON COLUMN xero_tokens.token_expiry IS
  'UTC expiry of the access_token (30 min after issue). Refresh via identity.xero.com/connect/token when NOW() >= token_expiry.';

COMMENT ON COLUMN xero_tokens.refresh_token IS
  'Valid for 60 days. After expiry the user must re-run the OAuth flow via /api/xero/auth.';
