import { afterEach, describe, expect, it, vi } from "vitest";
import { publicDetectionFailure } from "../lib/detectionCopy";
import { isAuthDisabled } from "../api/_lib/authMode.js";
import rates from "../api/beta/rates.js";
import scans from "../api/beta/scans.js";
import estimates from "../api/beta/estimates.js";
import detect from "../api/detect.js";

const VESH = "00000000-0000-0000-0000-000000000001";
const savedEnv = {
  AUTH_DISABLED: process.env.AUTH_DISABLED,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};

function mockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    setHeader() { return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    send(body: unknown) { this.body = body; return this; },
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
  process.env.ANTHROPIC_API_KEY = savedEnv.ANTHROPIC_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("auth switch", () => {
  it("treats an unset AUTH_DISABLED as the Vesh beta", () => {
    delete process.env.AUTH_DISABLED;
    expect(isAuthDisabled()).toBe(true);
  });

  it("turns login back on only for an explicit false", () => {
    process.env.AUTH_DISABLED = "false";
    expect(isAuthDisabled()).toBe(false);
    process.env.AUTH_DISABLED = "off";
    expect(isAuthDisabled()).toBe(false);
    process.env.AUTH_DISABLED = "true";
    expect(isAuthDisabled()).toBe(true);
  });
});

describe("public detection copy", () => {
  it("strips provider and model names from errors a person can see", () => {
    expect(publicDetectionFailure("Model not permitted: claude-sonnet-5")).toBe(
      "ElectraScan AI could not read this plan.",
    );
    expect(publicDetectionFailure("Detection failed (404): anthropic not_found_error")).toBe(
      "ElectraScan AI could not read this plan.",
    );
    expect(publicDetectionFailure("Set ANTHROPIC_API_KEY in Vercel.")).toBe(
      "ElectraScan AI could not read this plan.",
    );
    expect(publicDetectionFailure("Drawing has too many pages")).toBe(
      "ElectraScan AI could not read this plan. Drawing has too many pages",
    );
  });
});

describe("beta routes", () => {
  it("rejects beta routes when sign-in is required", async () => {
    process.env.AUTH_DISABLED = "false";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const res = mockRes();
    await rates({ method: "GET", headers: {}, url: "/api/beta/rates" }, res);
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("service-role-test");
  });

  it("asks for the service role key without returning one", async () => {
    delete process.env.AUTH_DISABLED;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = mockRes();
    await rates({ method: "GET", headers: {}, url: "/api/beta/rates" }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ|sb_secret_/);
  });

  it("reads every row when tenant_id does not exist, and only Vesh rows when it does", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      if (String(url).includes("tenant_id")) {
        return jsonResponse(400, {
          code: "42703",
          message: "column rate_library.tenant_id does not exist",
        });
      }
      return jsonResponse(200, [{ id: "1", code: "GPO-001", description: "Double GPO" }]);
    }));

    const missing = mockRes();
    await rates({ method: "GET", headers: {}, url: "/api/beta/rates" }, missing);
    expect(missing.statusCode).toBe(200);
    expect(missing.body).toEqual({ data: [{ id: "1", code: "GPO-001", description: "Double GPO" }] });
    expect(urls.some(url => url.includes("tenant_id"))).toBe(true);
    expect(urls.some(url => !url.includes("tenant_id"))).toBe(true);
    expect(JSON.stringify(missing.body)).not.toContain("service-role-test");

    urls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      return jsonResponse(200, [{ id: "2", code: "GPO-002" }]);
    }));
    const present = mockRes();
    await rates({ method: "GET", headers: {}, url: "/api/beta/rates" }, present);
    expect(present.statusCode).toBe(200);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(VESH);
    expect(urls[0]).toContain("tenant_id.is.null");
  });

  it("retries a scan insert without tenant_id when that column is missing", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const raw = String(init?.body || "");
      bodies.push(raw);
      if (raw.includes("tenant_id")) {
        return jsonResponse(400, {
          code: "42703",
          message: "column scans.tenant_id does not exist",
        });
      }
      return jsonResponse(200, [{ id: "scan-1", file_name: "plan.pdf" }]);
    }));

    const res = mockRes();
    await scans({
      method: "POST",
      headers: {},
      url: "/api/beta/scans",
      body: { file_name: "plan.pdf", detected_items: [{ symbol: "GPO" }] },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: "scan-1", file_name: "plan.pdf" } });
    expect(bodies[0]).toContain(VESH);
    expect(bodies[1]).not.toContain("tenant_id");
    expect(JSON.stringify(res.body)).not.toContain("service-role-test");
  });

  it("patches only the fields sent, so a quote link does not wipe the takeoff", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    let patched = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain(VESH);
      patched = String(init?.body || "");
      return jsonResponse(200, [{ id: "scan-1", estimate_ref: "EST-2610-0001" }]);
    }));
    const res = mockRes();
    await scans({
      method: "PATCH",
      headers: {},
      url: "/api/beta/scans?id=11111111-1111-4111-8111-111111111111",
      query: { id: "11111111-1111-4111-8111-111111111111" },
      body: { estimate_ref: "EST-2610-0001" },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(patched)).toEqual({ estimate_ref: "EST-2610-0001" });
  });

  it("allocates the next quote reference and stamps Vesh", async () => {
    delete process.env.AUTH_DISABLED;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const now = new Date();
    const prefix = `EST-${String(now.getUTCFullYear() % 100).padStart(2, "0")}${String(now.getUTCMonth() + 1).padStart(2, "0")}-`;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("reference=like")) {
        return jsonResponse(200, [{ reference: `${prefix}0007`, ref: `${prefix}0007` }]);
      }
      const body = JSON.parse(String(init?.body));
      expect(body.tenant_id).toBe(VESH);
      expect(body.reference).toBe(`${prefix}0008`);
      expect(body.ref).toBe(`${prefix}0008`);
      return jsonResponse(200, [{ id: "est-1", reference: body.reference }]);
    }));
    const res = mockRes();
    await estimates({
      method: "POST",
      headers: {},
      url: "/api/beta/estimates",
      body: { client: "Harbour & Co", subtotal: 100, margin_pct: 10, value: 121, line_items: [] },
    }, res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { reference: string }).reference).toMatch(/^EST-\d{4}-0008$/);
  });
});

describe("detection responses", () => {
  it("does not tell the browser the provider, the model, or the env var name", async () => {
    delete process.env.AUTH_DISABLED;
    delete process.env.ANTHROPIC_API_KEY;
    const missing = mockRes();
    await detect({ method: "POST", headers: {}, body: {} }, missing);
    expect(missing.statusCode).toBe(500);
    expect((missing.body as { code: string }).code).toBe("DETECTION_NOT_CONFIGURED");
    expect(JSON.stringify(missing.body)).not.toMatch(/claude|anthropic|api_key/i);

    process.env.ANTHROPIC_API_KEY = "test-detect-key";
    const rejected = mockRes();
    await detect({
      method: "POST",
      headers: {},
      body: { model: "claude-haiku-test", messages: [{ role: "user", content: "hi" }] },
    }, rejected);
    expect(rejected.statusCode).toBe(400);
    expect(JSON.stringify(rejected.body)).not.toMatch(/claude|anthropic/i);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, {
      error: { message: "model: claude-sonnet-5" },
    })));
    const upstream = mockRes();
    await detect({
      method: "POST",
      headers: {},
      body: {
        model: "claude-sonnet-5",
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      },
    }, upstream);
    expect(upstream.statusCode).toBe(502);
    expect(JSON.stringify(upstream.body)).not.toMatch(/claude|anthropic/i);
    expect(JSON.stringify(upstream.body)).not.toContain("test-detect-key");
  });
});
