import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTenantIdCache } from "../lib/tenants";
import { progressClaimInsert, reportsClaimInsert } from "../lib/milestoneClaimWrite";

const { builder, getUser, getSession, rpc } = vi.hoisted(() => {
  const builder = {
    insert: vi.fn(async () => ({ error: null })),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    then(resolve: (value: { error: null }) => void) {
      resolve({ error: null });
    },
  };
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  return {
    builder,
    getUser: vi.fn(),
    getSession: vi.fn(),
    rpc: vi.fn(),
  };
});

vi.mock("../services/supabaseClient", () => ({
  supabase: {
    from: () => builder,
    auth: { getUser, getSession },
    rpc,
  },
}));

import { submitMilestoneClaim as submitReportsClaim } from "../services/reportsService";
import { deleteMilestoneClaim, submitMilestoneClaim, updateMilestoneClaim } from "../services/supabaseData";

describe("milestone claim writes", () => {
  beforeEach(() => {
    clearTenantIdCache();
    builder.insert.mockClear();
    builder.update.mockClear();
    builder.delete.mockClear();
    builder.eq.mockClear();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getSession.mockResolvedValue({ data: { session: null } });
    rpc.mockResolvedValue({ data: "tenant-1", error: null });
  });

  it("builds the live burndown insert with the workspace and the audit user", () => {
    expect(progressClaimInsert({
      projectId: "EST-2611-0003",
      milestoneId: "first-fix",
      milestoneLabel: "First Fix",
      amount: 5117,
      invRef: "INV-2026-0003",
      status: "draft",
      tenantId: "tenant-1",
      ownerId: "user-1",
    })).toEqual({
      project_id: "EST-2611-0003",
      milestone_id: "first-fix",
      milestone_label: "First Fix",
      amount: 5117,
      inv_ref: "INV-2026-0003",
      status: "draft",
      tenant_id: "tenant-1",
      owner_id: "user-1",
    });
  });

  it("builds the Reports milestone insert on the real columns", () => {
    expect(reportsClaimInsert({
      projectName: "Mark Arnesen",
      milestone: "First Fix Complete",
      amount: 9120,
      claimedAt: "2026-11-12T00:00:00.000Z",
      status: "invoiced-draft",
      tenantId: "tenant-1",
      ownerId: "user-1",
    })).toMatchObject({
      project_name: "Mark Arnesen",
      milestone: "First Fix Complete",
      status: "invoiced-draft",
      tenant_id: "tenant-1",
      owner_id: "user-1",
    });
  });

  it("inserts a Reports claim with tenant_id and owner_id", async () => {
    const result = await submitReportsClaim({
      projectName: "Mark Arnesen",
      milestone: "First Fix Complete",
      amount: 9120,
      status: "invoiced-draft",
    });
    expect(result.ok).toBe(true);
    expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({
      project_name: "Mark Arnesen",
      milestone: "First Fix Complete",
      amount: 9120,
      status: "invoiced-draft",
      tenant_id: "tenant-1",
      owner_id: "user-1",
    })]);
    expect(builder.insert.mock.calls[0][0][0]).not.toHaveProperty("projectName");
  });

  it("does not insert a Reports claim when the caller has no workspace", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const result = await submitReportsClaim({ projectName: "Mark Arnesen", milestone: "First Fix", amount: 1 });
    expect(result.ok).toBe(false);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("inserts a progress claim with tenant_id and owner_id", async () => {
    const result = await submitMilestoneClaim("EST-2611-0003", "rough-in", "Rough-in", 1200);
    expect(result.ok).toBe(true);
    expect(builder.insert).toHaveBeenCalledWith([expect.objectContaining({
      project_id: "EST-2611-0003",
      milestone_id: "rough-in",
      milestone_label: "Rough-in",
      amount: 1200,
      status: "draft",
      tenant_id: "tenant-1",
      owner_id: "user-1",
    })]);
  });

  it("updates a claim status inside the tenant and does not filter by owner", async () => {
    const result = await updateMilestoneClaim("claim-1", { status: "received", invRef: "INV-9" });
    expect(result.ok).toBe(true);
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "received",
      inv_ref: "INV-9",
      tenant_id: "tenant-1",
      owner_id: "user-1",
    }));
    expect(builder.eq.mock.calls).toEqual([["id", "claim-1"], ["tenant_id", "tenant-1"]]);
  });

  it("deletes a claim inside the tenant and does not filter by owner", async () => {
    const result = await deleteMilestoneClaim("claim-1");
    expect(result.ok).toBe(true);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq.mock.calls).toEqual([["id", "claim-1"], ["tenant_id", "tenant-1"]]);
  });
});
