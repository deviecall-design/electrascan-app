import { afterEach, describe, expect, it, vi } from "vitest";
import records from "../api/beta/records.js";
import { RECORD_LIST_ORDER } from "../api/_lib/recordOrder.js";

const savedEnv = {
  AUTH_DISABLED: process.env.AUTH_DISABLED,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
};

function mockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    setHeader() { return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  process.env.AUTH_DISABLED = savedEnv.AUTH_DISABLED;
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = savedEnv.SUPABASE_URL;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("beta record list order", () => {
  it("orders each list by a column that table actually has", () => {
    expect(RECORD_LIST_ORDER.draft_invoices).toBe("created_at.desc");
    expect(RECORD_LIST_ORDER.job_actuals).toBe("spent_on.desc");
    expect(RECORD_LIST_ORDER.job_costs).toBe("spent_on.desc");
    expect(RECORD_LIST_ORDER.milestone_claims).toBe("created_at.desc");
    expect(RECORD_LIST_ORDER.detection_corrections).toBe("created_at.desc");
    expect(Object.values(RECORD_LIST_ORDER).some(order => order.startsWith("updated_at"))).toBe(true);
    expect(RECORD_LIST_ORDER.draft_invoices).not.toContain("updated_at");
    expect(RECORD_LIST_ORDER.job_actuals).not.toContain("updated_at");
    expect(RECORD_LIST_ORDER.job_costs).not.toContain("updated_at");
    expect(RECORD_LIST_ORDER.milestone_claims).not.toContain("updated_at");
  });

  it.each([
    ["invoices", "draft_invoices", "created_at.desc"],
    ["actuals", "job_actuals", "spent_on.desc"],
    ["costs", "job_costs", "spent_on.desc"],
    ["claims", "milestone_claims", "created_at.desc"],
    ["corrections", "detection_corrections", "created_at.desc"],
    ["assemblies", "assemblies", "updated_at.desc"],
  ])("GET %s asks PostgREST to order %s by %s", async (kind, table, order) => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      return jsonResponse(200, [{ id: "row-1", project_id: "EST-1", created_at: "2026-11-08T00:00:00Z" }]);
    }));
    const res = mockRes();
    await records({ method: "GET", headers: {}, url: `/api/beta/records?kind=${kind}` }, res);
    expect(res.statusCode).toBe(200);
    expect(urls[0]).toContain(`/rest/v1/${table}?`);
    expect(urls[0]).toContain(`order=${encodeURIComponent(order)}`);
    if (!order.startsWith("updated_at")) expect(urls[0]).not.toContain("updated_at");
    expect(urls).toHaveLength(1);
  });

  it("returns a short error when the ordered query is rejected, instead of an empty list", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(400, {
      code: "42703",
      message: "column draft_invoices.updated_at does not exist",
    })));
    const res = mockRes();
    await records({ method: "GET", headers: {}, url: "/api/beta/records?kind=invoices" }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Could not load this list." });
    expect(JSON.stringify(res.body)).not.toMatch(/updated_at|42703|does not exist/i);
  });

  it("still tells the app which migration to apply when the table itself is missing", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, {
      code: "PGRST205",
      message: "Could not find the table 'public.job_costs' in the schema cache",
    })));
    const res = mockRes();
    await records({ method: "GET", headers: {}, url: "/api/beta/records?kind=costs" }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: [], migration: "20261108050000_job_costs.sql" });
  });
});
