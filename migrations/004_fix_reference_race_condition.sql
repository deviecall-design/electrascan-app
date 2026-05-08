-- ElectraScan — atomic estimate reference sequence
--
-- The original trigger in 002_estimates_reference.sql derived the next
-- sequence number with COUNT/MAX over the estimates table. Under
-- concurrent INSERTs that read-then-write pattern races: two transactions
-- can read the same MAX, both compute next_seq = N+1, and both insert
-- 'EST-YYMM-N+1' — collision on the UNIQUE index (or worse, a duplicate
-- if the constraint were missing).
--
-- This migration replaces the function body with an atomic counter table.
-- INSERT … ON CONFLICT … DO UPDATE … RETURNING is a single statement,
-- and the per-row lock taken on the counter row serialises concurrent
-- callers, so each transaction sees its own monotonically incremented
-- last_seq. No advisory locks needed; works under any isolation level.
--
-- Run after 002_estimates_reference.sql. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS estimate_ref_counters (
  year_month TEXT PRIMARY KEY,
  last_seq   INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE estimate_ref_counters IS
  'Atomic per-month sequence counter for estimates.reference. One row per YYMM bucket; UPSERT-with-RETURNING gives each insert a unique, gap-tolerant sequence number without racing.';

-- Backfill the counters from any pre-existing references so the next
-- insert continues the sequence rather than restarting at 1 and
-- colliding with historical rows.
INSERT INTO estimate_ref_counters (year_month, last_seq)
SELECT
  SUBSTRING(reference FROM 'EST-(\d{4})-\d{4}$') AS year_month,
  MAX(CAST(SUBSTRING(reference FROM 'EST-\d{4}-(\d{4})$') AS INTEGER)) AS last_seq
FROM estimates
WHERE reference ~ '^EST-\d{4}-\d{4}$'
GROUP BY SUBSTRING(reference FROM 'EST-(\d{4})-\d{4}$')
ON CONFLICT (year_month) DO UPDATE
  SET last_seq = GREATEST(estimate_ref_counters.last_seq, EXCLUDED.last_seq);

CREATE OR REPLACE FUNCTION estimates_set_reference()
RETURNS TRIGGER AS $$
DECLARE
  prefix_key TEXT;
  seq        INTEGER;
BEGIN
  IF NEW.reference IS NOT NULL THEN
    RETURN NEW;
  END IF;

  prefix_key := to_char(COALESCE(NEW.created_at, now()), 'YYMM');

  -- Atomic UPSERT-and-increment. The row lock taken here serialises
  -- concurrent inserts within the same YYMM bucket so every caller gets
  -- a unique seq value in a single round-trip.
  INSERT INTO estimate_ref_counters (year_month, last_seq)
  VALUES (prefix_key, 1)
  ON CONFLICT (year_month)
  DO UPDATE SET last_seq = estimate_ref_counters.last_seq + 1
  RETURNING last_seq INTO seq;

  NEW.reference := 'EST-' || prefix_key || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimates_set_reference_trigger ON estimates;
CREATE TRIGGER estimates_set_reference_trigger
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION estimates_set_reference();
