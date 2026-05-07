-- ElectraScan: Symbol Dictionary + Legend Library
-- Migration: 2026-05-07
--
-- Implements the entity symbol dictionary and legend library described in spec §8.4.
-- symbol_dictionary: per-entity learned mapping of drawing symbol → Vesh catalogue item
-- legend_library:    per-entity builder/architect legend definitions (from pricing schedule scans)

-- ─────────────────────────────────────────────
-- SYMBOL DICTIONARY
-- One row per learned symbol-to-SKU mapping, per entity.
-- Built over time as tradies classify symbols during the Review Queue step.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS symbol_dictionary (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Entity this mapping belongs to (builder or architect)
  entity_id         uuid          NOT NULL,
  entity_name       text          NOT NULL,
  entity_type       text          NOT NULL CHECK (entity_type IN ('builder', 'architect')),

  -- The symbol as it appeared on the drawing (raw text or code)
  symbol_raw        text          NOT NULL,

  -- Normalised symbol after processing (uppercase, trimmed)
  symbol_normalised text          NOT NULL,

  -- The AS/NZS 1102 component type this symbol was classified as
  component_type    text          NOT NULL,

  -- The specific Vesh catalogue item ID chosen (after disambiguation if required)
  catalogue_id      text          NOT NULL,

  -- Confidence of this mapping (increases with validation_count)
  confidence        numeric(4,3)  NOT NULL DEFAULT 0.7
                    CHECK (confidence BETWEEN 0 AND 1),

  -- How many times a tradie has confirmed this mapping (drives confidence)
  validation_count  integer       NOT NULL DEFAULT 1,

  -- How the mapping was created
  source            text          NOT NULL CHECK (source IN (
    'manual_classification',   -- tradie classified it in Review Queue
    'legend_onboarding',       -- Vesh confirmed during entity onboarding
    'auto_confirmed'           -- high-confidence auto-match confirmed by tradie
  )),

  -- Which drawing first produced this mapping
  source_drawing_id uuid,

  first_seen        timestamptz   NOT NULL DEFAULT now(),
  last_validated    timestamptz   NOT NULL DEFAULT now(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  -- One mapping per symbol per entity per owner
  UNIQUE (owner_id, entity_id, symbol_normalised)
);

-- RLS: owner can only see/modify their own entity dictionaries
ALTER TABLE symbol_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symbol_dictionary_owner" ON symbol_dictionary
  FOR ALL USING (auth.uid() = owner_id);

-- Indexes
CREATE INDEX idx_symbol_dict_entity      ON symbol_dictionary (owner_id, entity_id);
CREATE INDEX idx_symbol_dict_normalised  ON symbol_dictionary (owner_id, symbol_normalised);
CREATE INDEX idx_symbol_dict_catalogue   ON symbol_dictionary (catalogue_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_symbol_dictionary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_symbol_dict_updated_at
  BEFORE UPDATE ON symbol_dictionary
  FOR EACH ROW EXECUTE FUNCTION update_symbol_dictionary_updated_at();

-- ─────────────────────────────────────────────
-- LEGEND LIBRARY
-- Stores the parsed legend/key from each builder or architect's documents.
-- Built during "pricing schedule scan" mode — reads the builder's own legend
-- and stores each entry so future scans from the same source auto-classify.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legend_library (
  id                uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Entity this legend belongs to
  entity_id         uuid          NOT NULL,
  entity_name       text          NOT NULL,

  -- The legend entry exactly as it appeared in the document
  legend_code       text          NOT NULL,  -- e.g. "DL", "GPO", "S2"
  legend_description text         NOT NULL,  -- e.g. "LED downlight", "Double power point"

  -- Resolved mapping (null = not yet resolved — goes to manual onboarding queue)
  component_type    text,
  catalogue_id      text,

  -- Which scan first produced this legend entry
  source_drawing_id uuid          NOT NULL,
  source_filename   text,

  -- Confidence that this legend entry is correctly mapped
  confidence        numeric(4,3)  DEFAULT NULL
                    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),

  confirmed_by_user boolean       NOT NULL DEFAULT false,
  confirmed_at      timestamptz,

  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (owner_id, entity_id, legend_code)
);

ALTER TABLE legend_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legend_library_owner" ON legend_library
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX idx_legend_lib_entity      ON legend_library (owner_id, entity_id);
CREATE INDEX idx_legend_lib_code        ON legend_library (owner_id, entity_id, legend_code);
CREATE INDEX idx_legend_lib_unresolved  ON legend_library (owner_id) WHERE catalogue_id IS NULL;

CREATE OR REPLACE FUNCTION update_legend_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_legend_lib_updated_at
  BEFORE UPDATE ON legend_library
  FOR EACH ROW EXECUTE FUNCTION update_legend_library_updated_at();

-- ─────────────────────────────────────────────
-- ENTITY TABLE
-- Normalised entity records (builders and architects).
-- Referenced by symbol_dictionary and legend_library.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entities (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id            uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name                text          NOT NULL,
  type                text          NOT NULL CHECK (type IN ('builder', 'architect')),
  contact_email       text,

  -- Running stats (updated by trigger or app logic)
  drawings_processed  integer       NOT NULL DEFAULT 0,
  avg_confidence      numeric(4,3)  DEFAULT NULL,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (owner_id, name, type)
);

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entities_owner" ON entities
  FOR ALL USING (auth.uid() = owner_id);

CREATE INDEX idx_entities_owner ON entities (owner_id);
CREATE INDEX idx_entities_type  ON entities (owner_id, type);

-- ─────────────────────────────────────────────
-- SYMBOL RESOLUTION VIEW
-- Convenience view: joins symbol_dictionary with rate_library
-- so the detection engine can resolve symbol → price in one query.
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW symbol_resolution AS
SELECT
  sd.owner_id,
  sd.entity_id,
  sd.entity_name,
  sd.symbol_normalised                AS symbol,
  sd.component_type,
  sd.catalogue_id,
  sd.confidence                       AS symbol_confidence,
  sd.validation_count,
  rl.name                             AS item_name,
  rl.category,
  rl.unit,
  rl.my_rate                          AS price,
  rl.off_form_rate                    AS off_form_price
FROM symbol_dictionary sd
LEFT JOIN rate_library rl
  ON rl.catalogue_id = sd.catalogue_id
  AND rl.owner_id    = sd.owner_id;

-- ─────────────────────────────────────────────
-- HELPER FUNCTION: upsert_symbol_classification
-- Called by the app when a tradie confirms or corrects a symbol classification.
-- Increments validation_count and updates confidence on repeat confirmations.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_symbol_classification(
  p_owner_id          uuid,
  p_entity_id         uuid,
  p_entity_name       text,
  p_entity_type       text,
  p_symbol_raw        text,
  p_component_type    text,
  p_catalogue_id      text,
  p_source            text,
  p_source_drawing_id uuid DEFAULT NULL
) RETURNS symbol_dictionary AS $$
DECLARE
  v_normalised text := upper(trim(p_symbol_raw));
  v_result     symbol_dictionary;
BEGIN
  -- Security: callers may only write to their own owner_id.
  -- SECURITY DEFINER elevates privileges for the INSERT; this guard ensures
  -- p_owner_id cannot be used to overwrite another user's symbol dictionary.
  IF p_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'upsert_symbol_classification: p_owner_id must match the authenticated user';
  END IF;

  INSERT INTO symbol_dictionary (
    owner_id, entity_id, entity_name, entity_type,
    symbol_raw, symbol_normalised,
    component_type, catalogue_id,
    confidence, validation_count, source, source_drawing_id
  ) VALUES (
    p_owner_id, p_entity_id, p_entity_name, p_entity_type,
    p_symbol_raw, v_normalised,
    p_component_type, p_catalogue_id,
    0.7, 1, p_source, p_source_drawing_id
  )
  ON CONFLICT (owner_id, entity_id, symbol_normalised) DO UPDATE SET
    catalogue_id      = EXCLUDED.catalogue_id,
    component_type    = EXCLUDED.component_type,
    validation_count  = symbol_dictionary.validation_count + 1,
    -- Confidence grows toward 1.0 with each validation, asymptotically
    confidence        = LEAST(1.0, symbol_dictionary.confidence + (1.0 - symbol_dictionary.confidence) * 0.15),
    last_validated    = now(),
    updated_at        = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
