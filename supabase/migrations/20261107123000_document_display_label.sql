-- Optional label for a scan or estimate. The EST reference stays the unique key.
-- Empty means "use the cleaned plan file name". Nothing is dropped or rewritten.

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS display_label text;
