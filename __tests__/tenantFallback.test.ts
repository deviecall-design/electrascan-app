import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "../services/supabaseClient";
import { clearTenantIdCache, getCurrentTenantId, VESH_TENANT_ID } from "../lib/tenants";

describe("getCurrentTenantId", () => {
  beforeEach(() => {
    clearTenantIdCache();
    vi.mocked(supabase.rpc).mockReset();
  });

  it("does not fall back to Vesh when the caller has no membership", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
    await expect(getCurrentTenantId()).resolves.toBeNull();
    expect(VESH_TENANT_ID).not.toBeNull();
  });

  it("returns the membership from get_tenant_id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: "tenant-from-db", error: null } as never);
    await expect(getCurrentTenantId()).resolves.toBe("tenant-from-db");
  });
});
