-- legend_library: per-tenant store of builder/architect symbol mappings
-- learned over time. Every row records a symbol image (or hash) → rate
-- library item mapping for one (owner, entity) pair. Subsequent scans
-- look here first before invoking the vesh_catalogue heuristics.
--
-- Confidence and validation_count let us promote frequently-validated
-- mappings to "trusted" tiers in the matcher; first_seen / last_validated
-- give us a learning curve to display in the Library UI.

CREATE TABLE IF NOT EXISTS legend_library (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID NOT NULL REFERENCES auth.users(id),
  entity_id            UUID NOT NULL,                     -- references the builder/architect entity
  entity_name          TEXT NOT NULL,                     -- denormalised for query convenience
  entity_type          TEXT NOT NULL CHECK (entity_type IN ('builder', 'architect')),
  symbol_pattern       TEXT NOT NULL,                     -- base64 or hash of the symbol image, or text description
  symbol_image_url     TEXT,                              -- Supabase Storage URL for cropped symbol image
  classification       TEXT NOT NULL,                     -- human-readable name e.g. "12W LED Downlight"
  component_category   TEXT NOT NULL,                     -- matches tenant category system
  rate_library_id      UUID REFERENCES rate_library(id),  -- the matched rate item
  confidence           NUMERIC(4,2) DEFAULT 0,            -- 0.00 to 100.00
  validation_count     INT DEFAULT 1,                     -- how many times this mapping has been validated
  first_seen           TIMESTAMPTZ DEFAULT NOW(),
  last_validated       TIMESTAMPTZ DEFAULT NOW(),
  source_drawing_id    UUID,                              -- which scan this was first identified in
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: a user only ever sees / mutates their own rows.
ALTER TABLE legend_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own legend entries" ON legend_library;
CREATE POLICY "Users can manage own legend entries"
  ON legend_library FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Fast lookups when matching a fresh drawing to a known builder/architect.
CREATE INDEX IF NOT EXISTS legend_library_entity_idx
  ON legend_library(owner_id, entity_id);

-- Fast lookups when probing an extracted symbol against the cache.
CREATE INDEX IF NOT EXISTS legend_library_pattern_idx
  ON legend_library(owner_id, symbol_pattern);

-- Keep updated_at fresh on any mutation.
CREATE OR REPLACE FUNCTION legend_library_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legend_library_set_updated_at ON legend_library;
CREATE TRIGGER legend_library_set_updated_at
  BEFORE UPDATE ON legend_library
  FOR EACH ROW
  EXECUTE FUNCTION legend_library_touch_updated_at();

COMMENT ON TABLE legend_library IS
  'Per-tenant cache of (entity, symbol) → rate-library mappings learned across scans. Drives the legend matcher in analyze_pdf.ts.';
