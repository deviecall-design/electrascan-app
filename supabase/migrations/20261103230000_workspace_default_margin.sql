-- Tenant default quote margin. Additive. Does not change existing estimates.
-- Estimates already store margin_pct, so a saved or signed quote keeps its own margin.
-- Apply in the Supabase SQL editor for project zxeznkuodpseijkvjwxa.

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS default_margin_pct numeric;

ALTER TABLE public.workspace_settings
  DROP CONSTRAINT IF EXISTS workspace_settings_default_margin_pct_range;

ALTER TABLE public.workspace_settings
  ADD CONSTRAINT workspace_settings_default_margin_pct_range
  CHECK (
    default_margin_pct IS NULL
    OR (default_margin_pct >= 0 AND default_margin_pct <= 100)
  );
