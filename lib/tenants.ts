import { authIsDisabled } from "./authMode";
import { supabase } from "../services/supabaseClient";

export const VESH_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// Session-scoped cache. Cleared on sign-out. Never seed this with Vesh:
// a signed-in visitor who is not on the allowlist must not stamp Vesh's id.
let _cachedTenantId: string | null = null;

/**
 * Tenant for the current session, from `get_tenant_id()`.
 * Returns null when the caller has no membership. It does not fall back to Vesh.
 */
export async function getCurrentTenantId(): Promise<string | null> {
  if (authIsDisabled()) return VESH_TENANT_ID;
  if (_cachedTenantId) return _cachedTenantId;
  const { data, error } = await supabase.rpc("get_tenant_id");
  if (!error && data) {
    _cachedTenantId = data as string;
    return _cachedTenantId;
  }
  return null;
}

/** Remember the id returned by provision_workspace so the next write uses it. */
export function rememberTenantId(tenantId: string | null): void {
  _cachedTenantId = tenantId;
}

/** Clear the cached tenant_id (call on sign-out). */
export function clearTenantIdCache(): void {
  _cachedTenantId = null;
}
