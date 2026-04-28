-- Add reference column to estimates.
--
-- Format: EST-YYMM-XXXX
--   YYMM   two-digit year + two-digit month (e.g. 2604 for April 2026)
--   XXXX   four-digit, zero-padded sequence per (owner, YYMM)
--
-- Example: EST-2604-0001
--
-- The sequence is computed server-side at insert time (see
-- api/estimates/create.js) by querying MAX(reference) for the current
-- prefix scoped to the calling owner. The unique index prevents two
-- concurrent inserts from claiming the same reference; the API retries
-- on the resulting 23505 conflict.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS reference VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS estimates_owner_reference_uniq
  ON estimates (owner_id, reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_reference_idx
  ON estimates (reference);

COMMENT ON COLUMN estimates.reference IS
  'Tenant-facing estimate reference, format EST-YYMM-XXXX. Sequence resets monthly per owner.';
