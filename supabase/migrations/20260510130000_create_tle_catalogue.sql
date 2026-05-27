-- TLE Brookvale full product catalogue.
-- Populated by scraper via Unbxd API (116K+ products).
-- Read-only reference table — no RLS needed, no tenant scoping.

CREATE TABLE IF NOT EXISTS tle_catalogue (
  sku          text PRIMARY KEY,
  name         text NOT NULL,
  brand        text,
  category     text,
  url          text,
  in_stock     boolean DEFAULT false,
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tle_catalogue_brand    ON tle_catalogue (brand);
CREATE INDEX IF NOT EXISTS idx_tle_catalogue_category ON tle_catalogue (category);
CREATE INDEX IF NOT EXISTS idx_tle_catalogue_name_trgm ON tle_catalogue USING GIN (name gin_trgm_ops);

-- Public read, no write via anon
ALTER TABLE tle_catalogue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tle_catalogue_read" ON tle_catalogue FOR SELECT USING (true);
