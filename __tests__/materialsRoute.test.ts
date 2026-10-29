import { afterEach, describe, expect, it, vi } from "vitest";
import materials from "../api/beta/materials.js";

const saved = process.env.AUTH_DISABLED;
const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function mockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    setHeader() { return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

afterEach(() => {
  process.env.AUTH_DISABLED = saved;
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  vi.unstubAllGlobals();
});

describe("materials route", () => {
  it("stores quantities and brands and drops any supplier price", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    let posted = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      posted = String(init?.body || "");
      return new Response(JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", status: "draft" }]), { status: 200 });
    }));
    const res = mockRes();
    await materials({
      method: "POST",
      headers: {},
      url: "/api/beta/materials",
      body: {
        job_name: "Harbour",
        supplier_name: "Lawrence & Hanson",
        lines: [{ product: "Double GPO", qty: 4, brand: "Clipsal", price: 88, discount: 15 }],
        status: "draft",
      },
    }, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(posted);
    expect(body.lines[0]).toEqual({ product: "Double GPO", qty: 4, brand: "Clipsal", unit: "ea", notes: "" });
    expect(JSON.stringify(body.lines)).not.toMatch(/price|discount/);
    expect(JSON.stringify(res.body)).not.toContain("service-role-test");
  });

  it("does not send mail when the status changes", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      return new Response(JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", status: "sent" }]), { status: 200 });
    }));
    const res = mockRes();
    await materials({
      method: "PATCH",
      headers: {},
      url: "/api/beta/materials?id=11111111-1111-4111-8111-111111111111",
      query: { id: "11111111-1111-4111-8111-111111111111" },
      body: { status: "sent", lines: [] },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(urls.every(url => url.includes("materials_requests"))).toBe(true);
  });
});
