-- Add tenant_profile JSONB to user_prefs.
--
-- The Settings screen lets each user manage one company profile that
-- becomes the white-label branding on every PDF and builder-facing
-- email (no ElectraScan branding leaves the app). The fields are:
--
--   {
--     "name":        "Vesh Electrical",
--     "abn":         "00 000 000 000",
--     "address":     "...",
--     "contactEmail":"hello@vesh.com.au",
--     "contactPhone":"02 1234 5678",
--     "emailReplyTo":"admin@vesh.com.au",
--     "logoUrl":     "https://<supabase>.storage/.../logo.png"
--   }
--
-- Stored as JSONB so tenants can extend (e.g. licence number, accent
-- colour) without further migrations. Logos themselves live in the
-- `logos` Supabase Storage bucket; only the public URL is persisted.

ALTER TABLE user_prefs
  ADD COLUMN IF NOT EXISTS tenant_profile JSONB DEFAULT '{}'::jsonb;

-- Storage bucket for logos. Idempotent: skips if already created.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on logos so PDF/email generators can embed by URL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read logos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read logos" ON storage.objects
        FOR SELECT
        USING (bucket_id = 'logos');
    $policy$;
  END IF;
END $$;

-- Authenticated users can upload / replace their own logo. Path
-- convention: <user_id>/<filename> — the leading folder is the owner.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own logos'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users manage own logos" ON storage.objects
        FOR ALL
        USING (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1])
        WITH CHECK (bucket_id = 'logos' AND (auth.uid())::text = (storage.foldername(name))[1]);
    $policy$;
  END IF;
END $$;
