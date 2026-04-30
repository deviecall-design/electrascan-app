import { supabase } from './supabaseClient';
import type { TenantConfig } from '../types/tenant';

// Tenant company profile persistence.
//
// Stored in user_prefs.tenant_profile (JSONB) keyed on user_email.
// Logos live in the `logos` Supabase Storage bucket — we persist only
// the public URL. The Settings screen is the only writer; PDF and
// email generators are read-only consumers of the same data.
//
// Anon access:
// - If supabase.auth.getUser() returns null we degrade to `{ ok: false,
//   reason: 'unauthenticated' }`. Callers can then fall back to the
//   localStorage-backed TenantContext defaults.

const LOGO_BUCKET = 'logos';

export type TenantProfile = Pick<
  TenantConfig,
  'name' | 'abn' | 'address' | 'contactEmail' | 'contactPhone' | 'emailReplyTo' | 'logoUrl' | 'wholesalers'
>;

async function currentUserEmail(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function fetchTenantProfile(): Promise<
  | { ok: true; profile: Partial<TenantProfile> | null }
  | { ok: false; error: string }
> {
  const email = await currentUserEmail();
  if (!email) return { ok: false, error: 'unauthenticated' };
  try {
    const { data, error } = await supabase
      .from('user_prefs')
      .select('tenant_profile')
      .eq('user_email', email)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, profile: (data?.tenant_profile as Partial<TenantProfile>) ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function saveTenantProfile(
  profile: TenantProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await currentUserEmail();
  if (!email) return { ok: false, error: 'unauthenticated' };
  try {
    const { error } = await supabase.from('user_prefs').upsert(
      {
        user_email: email,
        tenant_profile: profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}

export async function uploadLogo(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'unauthenticated' };

  // Path convention <user_id>/<filename> — RLS policy in
  // 20260428120100_add_user_prefs_tenant_profile.sql checks the leading
  // folder against auth.uid().
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const filename = `logo-${Date.now()}.${ext}`;
  const path = `${userId}/${filename}`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) return { ok: false, error: 'No public URL returned' };
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
