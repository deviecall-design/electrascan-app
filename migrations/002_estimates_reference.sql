-- ElectraScan — sequential `reference` column for estimates
-- Format: EST-YYMM-XXXX (e.g. EST-2604-0001, EST-2604-0002, …)
-- Sequence resets each month; XXXX is global across tenants for simplicity.
--
-- Run after 001_create_tables.sql. Idempotent: safe to re-run.

ALTER TABLE estimates ADD COLUMN IF NOT EXISTS reference TEXT UNIQUE;

CREATE OR REPLACE FUNCTION estimates_set_reference()
RETURNS TRIGGER AS $$
DECLARE
  yymm TEXT;
  next_seq INTEGER;
  new_ref TEXT;
BEGIN
  IF NEW.reference IS NOT NULL THEN
    RETURN NEW;
  END IF;

  yymm := to_char(COALESCE(NEW.created_at, now()), 'YYMM');

  -- Find the highest existing sequence for this month, default to 0.
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(reference FROM 'EST-' || yymm || '-(\d{4})$') AS INTEGER)),
    0
  )
  INTO next_seq
  FROM estimates
  WHERE reference LIKE 'EST-' || yymm || '-%';

  next_seq := next_seq + 1;
  new_ref := 'EST-' || yymm || '-' || lpad(next_seq::text, 4, '0');

  NEW.reference := new_ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimates_set_reference_trigger ON estimates;
CREATE TRIGGER estimates_set_reference_trigger
  BEFORE INSERT ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION estimates_set_reference();

-- Backfill any existing rows that don't have a reference yet.
DO $$
DECLARE
  r RECORD;
  yymm TEXT;
  next_seq INTEGER;
BEGIN
  FOR r IN SELECT id, created_at FROM estimates WHERE reference IS NULL ORDER BY created_at LOOP
    yymm := to_char(COALESCE(r.created_at, now()), 'YYMM');
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(reference FROM 'EST-' || yymm || '-(\d{4})$') AS INTEGER)),
      0
    )
    INTO next_seq
    FROM estimates
    WHERE reference LIKE 'EST-' || yymm || '-%';
    next_seq := next_seq + 1;
    UPDATE estimates
       SET reference = 'EST-' || yymm || '-' || lpad(next_seq::text, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;
