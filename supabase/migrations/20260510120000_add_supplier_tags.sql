-- Add supplier tags to rate_library_items.
-- suppliers: array of wholesaler names e.g. {"TLE","Reece","Rexel"}
-- supplier_skus: wholesaler-specific SKU map e.g. {"TLE":"CLI3025VW","Reece":"XYZ"}
-- Allows BOM filter: SELECT * FROM rate_library_items WHERE 'TLE' = ANY(suppliers)

ALTER TABLE rate_library_items
  ADD COLUMN IF NOT EXISTS suppliers    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS supplier_skus jsonb  NOT NULL DEFAULT '{}';

-- Index for fast per-supplier filtering
CREATE INDEX IF NOT EXISTS idx_rate_library_items_suppliers
  ON rate_library_items USING GIN (suppliers);
