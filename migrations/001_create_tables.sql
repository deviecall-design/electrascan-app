-- ElectraScan — Supabase table creation script
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Creates three tables: estimates, scans, rate_library
-- Each has RLS enabled with policies scoped to the authenticated user.
-- After running this, seed rate_library with the INSERT block at the bottom.

-- ─── 1. ESTIMATES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estimates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref         TEXT NOT NULL,
  client      TEXT NOT NULL,
  value       NUMERIC NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'sent', 'viewed', 'approved')),
  days_since_sent INTEGER DEFAULT 0,
  project_name TEXT,
  drawing_file TEXT,
  margin_pct   NUMERIC DEFAULT 15,
  subtotal     NUMERIC DEFAULT 0,
  line_items   JSONB DEFAULT '[]'::jsonb,
  owner_id    UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own estimates"
  ON estimates FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users insert own estimates"
  ON estimates FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own estimates"
  ON estimates FOR UPDATE
  USING (owner_id = auth.uid());

-- ─── 2. SCANS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name       TEXT NOT NULL,
  client          TEXT,
  stage           TEXT DEFAULT 'Uploading',
  items_detected  INTEGER DEFAULT 0,
  progress        INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  estimate_ref    TEXT,
  detected_items  JSONB DEFAULT '[]'::jsonb,
  risk_flags      JSONB DEFAULT '[]'::jsonb,
  raw_response    TEXT,
  owner_id        UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own scans"
  ON scans FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users insert own scans"
  ON scans FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own scans"
  ON scans FOR UPDATE
  USING (owner_id = auth.uid());

-- ─── 3. RATE LIBRARY ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_library (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'ea',
  rate        NUMERIC NOT NULL DEFAULT 0,
  labour      NUMERIC NOT NULL DEFAULT 0,
  is_custom   BOOLEAN DEFAULT false,
  owner_id    UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  synced_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code, owner_id)
);

ALTER TABLE rate_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rates"
  ON rate_library FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users insert own rates"
  ON rate_library FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own rates"
  ON rate_library FOR UPDATE
  USING (owner_id = auth.uid());

-- ─── 4. SEED RATE LIBRARY ───────────────────────────────────────────────
-- Run this AFTER signing in as the tenant user so owner_id is set correctly.
-- If you want to seed for a specific user, replace auth.uid() with their UUID.

INSERT INTO rate_library (code, category, description, unit, rate, labour) VALUES
  ('GPO-001', 'Power',    'Double GPO install (flush)',        'ea',  85,   45),
  ('GPO-002', 'Power',    'Double GPO with USB-C',             'ea',  125,  45),
  ('GPO-003', 'Power',    'Weatherproof GPO IP56',             'ea',  145,  60),
  ('GPO-004', 'Power',    'Single GPO install',                'ea',  65,   35),
  ('GPO-005', 'Power',    '3-phase outlet 32A',                'ea',  320,  120),
  ('LT-001',  'Lighting', 'LED downlight 10W dimmable',        'ea',  65,   40),
  ('LT-002',  'Lighting', 'LED downlight 13W tri-colour',      'ea',  85,   40),
  ('LT-003',  'Lighting', 'Oyster light LED 18W',              'ea',  95,   35),
  ('LT-004',  'Lighting', 'LED strip 5m (incl. driver)',       'set', 180,  90),
  ('LT-005',  'Lighting', 'Pendant rough-in',                  'ea',  120,  55),
  ('SW-001',  'Switches', 'Single switch 1-gang',              'ea',  45,   25),
  ('SW-002',  'Switches', '2-way switch 1-gang',               'ea',  55,   30),
  ('SW-003',  'Switches', 'Dimmer switch LED-compatible',      'ea',  95,   35),
  ('SW-004',  'Switches', '4-gang switch plate',               'ea',  110,  40),
  ('CB-001',  'Cabling',  'TPS 2.5mm² per metre',              'm',   8,    4),
  ('CB-002',  'Cabling',  'TPS 4mm² per metre',                'm',   12,   5),
  ('CB-003',  'Cabling',  'TPS 6mm² per metre',                'm',   18,   6),
  ('CB-004',  'Cabling',  'Cat6A data cable per metre',         'm',   6,    3),
  ('CB-005',  'Cabling',  'Conduit 20mm orange per metre',      'm',   4,    3),
  ('SB-001',  'Boards',   'Meter box upgrade to 100A',          'ea',  1450, 480),
  ('SB-002',  'Boards',   'Distribution board 12-way',          'ea',  680,  320),
  ('SB-003',  'Boards',   'RCBO install per pole',              'ea',  145,  45),
  ('SB-004',  'Boards',   'Main switch 63A',                    'ea',  220,  85),
  ('SA-001',  'Safety',   'Smoke alarm 240V interconnect',      'ea',  140,  50),
  ('SA-002',  'Safety',   'RCD safety switch install',          'ea',  180,  60),
  ('SA-003',  'Safety',   'Emergency exit light LED',           'ea',  220,  85),
  ('DC-001',  'Data',     'Cat6A data point + faceplate',       'ea',  135,  55),
  ('DC-002',  'Data',     'TV point + coax run',                'ea',  110,  45),
  ('DC-003',  'Data',     'Patch panel 24-port install',        'ea',  280,  120),
  ('FN-001',  'Fans',     'Bathroom exhaust fan + duct',        'ea',  185,  75),
  ('FN-002',  'Fans',     'Ceiling fan rough-in',               'ea',  145,  55),
  ('EX-001',  'Ext.',     'External sensor light LED',          'ea',  155,  65),
  ('EX-003',  'Ext.',     'EV charger 7kW single-phase',        'ea',  1850, 380),
  ('TS-001',  'Testing',  'Pre-handover test & tag',            'hr',  125,  125),
  ('TS-002',  'Testing',  'Compliance certificate',             'ea',  280,  0)
ON CONFLICT (code, owner_id) DO NOTHING;
