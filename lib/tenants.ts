/**
 * Tenant constants for ElectraScan.
 *
 * Single-tenant phase: Vesh Electrical is the only tenant.
 * When multi-tenant auth is wired, replace getCurrentTenantId() with:
 *   return (await supabase.rpc('get_tenant_id')) as string;
 */

export const VESH_TENANT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Returns the active tenant_id for the current session.
 * Currently hardcoded to Vesh Electrical; will become a Supabase RPC call
 * once multiple tenants are onboarded.
 */
export const getCurrentTenantId = (): string => VESH_TENANT_ID;
