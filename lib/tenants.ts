import { supabase } from "../services/supabaseClient";

export const VESH_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Session-scoped cache — avoids repeated RPC calls within a single page session.
// Cleared on sign-out by supabase.auth.onAuthStateChange in supabaseClient.ts (if wired).
let _cachedTenantId: string | null = null;

/**
 * Returns the tenant_id for the current authenticated session via Supabase RPC.
 * Falls back to the Vesh hardcoded value if the user is unauthenticated or the
 * RPC returns null (bootstrap/migration window).
 */
export async function getCurrentTenantId(): Promise<string> {
  if (_cachedTenantId) return _cachedTenantId;
  const { data, error } = await supabase.rpc('get_tenant_id');
  if (!error && data) {
    _cachedTenantId = data as string;
    return _cachedTenantId;
  }
  return VESH_TENANT_ID;
}

/** Clear the cached tenant_id (call on sign-out). */
export function clearTenantIdCache(): void {
  _cachedTenantId = null;
}
