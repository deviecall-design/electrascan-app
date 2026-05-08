-- ElectraScan — legend_library table
-- Per-tenant knowledge base of builder/architect symbol legends.
--
-- Each builder draws plans with their own quirky symbol vocabulary
-- ("Φ" might mean recessed downlight for Mirvac but a wall sconce for
-- Multiplex). The pricing-schedule scan mode learns those mappings as the
-- tenant works through quotes, building a private library of
-- symbol → description / category / unit_rate that future scans can match
-- against without re-prompting the model.
--
-- Source distinguishes auto-extracted entries ("pricing_schedule_scan")
-- from human edits ("manual"), so we can later prefer trusted rows or
-- prompt the user to confirm low-confidence ones.
--
-- Run after 001_create_tables.sql. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS legend_library (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  builder_name  TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  unit_rate     NUMERIC,
  source        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE legend_library IS
  'Per-tenant builder/architect symbol legend. Each row maps a symbol drawn by a specific builder to its electrical meaning, category and unit rate. Populated by the pricing-schedule scan mode and edited manually. Powers the second scan mode by giving Claude prior context on how each builder annotates their plans.';

CREATE INDEX IF NOT EXISTS idx_legend_library_owner_builder_symbol
  ON legend_library (owner_id, builder_name, symbol);

-- Keep updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION legend_library_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legend_library_touch_updated_at_trigger ON legend_library;
CREATE TRIGGER legend_library_touch_updated_at_trigger
  BEFORE UPDATE ON legend_library
  FOR EACH ROW
  EXECUTE FUNCTION legend_library_touch_updated_at();

ALTER TABLE legend_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own legend entries"   ON legend_library;
DROP POLICY IF EXISTS "Users insert own legend entries" ON legend_library;
DROP POLICY IF EXISTS "Users update own legend entries" ON legend_library;
DROP POLICY IF EXISTS "Users delete own legend entries" ON legend_library;

CREATE POLICY "Users read own legend entries"
  ON legend_library FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users insert own legend entries"
  ON legend_library FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own legend entries"
  ON legend_library FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users delete own legend entries"
  ON legend_library FOR DELETE
  USING (owner_id = auth.uid());
