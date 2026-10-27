import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when the Vite build was given the public Supabase URL and anon key.
 * Without them every query fails; the UI shows that instead of spinning.
 */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * supabase-js takes `navigator.locks` whenever the browser exposes it.
 * A lock that never releases (a crashed tab, or a headless browser whose
 * LockManager never calls back) leaves `getSession()` and every `.from()`
 * query pending. The dashboard then sits on "Loading your pipeline…" forever.
 * Run the critical section directly. This app has a single client.
 */
async function bypassNavigatorLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  return await fn();
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'https://placeholder.invalid',
  SUPABASE_ANON_KEY || 'public-anon-key',
  {
    auth: {
      persistSession: supabaseConfigured,
      autoRefreshToken: supabaseConfigured,
      detectSessionInUrl: supabaseConfigured,
      lock: bypassNavigatorLock,
    },
  },
);
