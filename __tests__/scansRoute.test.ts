import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import scans from "../api/beta/scans.js";
import { resetRateLimits } from "../api/_lib/rateLimit.js";

const savedEnv = {
  AUTH_DISABLED: process.env.AUTH_DISABLED,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: null as unknown,
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: string) { headers[name] = value; return this; },
    header(name: string) { return headers[name]; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; this.headersSent = true; return this; },
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  delete process.env.AUTH_DISABLED;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  resetRateLimits();
});

afterEach(() => {
  process.env.AUTH_DISABLED = savedEnv.AUTH_DISABLED;
  process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.SUPABASE_SERVICE_ROLE_KEY;
  resetRateLimits();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("beta scans route", () => {
  it("reads the scan id with the WHATWG URL and never touches req.query", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [{ id: "scan-1", file_name: "plan.pdf" }])));
    const res = mockRes();
    const req = {
      method: "GET",
      headers: { "x-real-ip": "203.0.113.10" },
      url: "/api/beta/scans?id=11111111-1111-4111-8111-111111111111",
    };
    Object.defineProperty(req, "query", {
      get() {
        throw new Error("DEP0169 url.parse");
      },
    });

    await scans(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: { id: "scan-1", file_name: "plan.pdf" } });
  });

  it("rejects a plan that is not a PDF or PNG and stores only the file name", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const posted = JSON.parse(String(init?.body || "{}"));
      expect(posted.file_name).toBe("level-1.PDF");
      return jsonResponse(200, [{ id: "scan-1", file_name: posted.file_name }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const rejected = mockRes();
    await scans({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.11", "content-type": "application/json" },
      url: "/api/beta/scans",
      body: { file_name: "switchboard.docx" },
    }, rejected);
    expect(rejected.statusCode).toBe(400);
    expect(rejected.body).toEqual({ error: "Upload a PDF or PNG floor plan." });
    expect(fetchMock).not.toHaveBeenCalled();

    const saved = mockRes();
    await scans({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.11", "content-type": "application/json" },
      url: "/api/beta/scans",
      body: { file_name: "../../secret/level-1.PDF" },
    }, saved);
    expect(saved.statusCode).toBe(200);
    expect(saved.body).toEqual({ data: { id: "scan-1", file_name: "level-1.PDF" } });
  });

  it("rejects an oversized body and a JSON body that is not an object", async () => {
    const tooBig = mockRes();
    await scans({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.12", "content-length": "2000000", "content-type": "application/json" },
      url: "/api/beta/scans",
      body: { file_name: "plan.pdf" },
    }, tooBig);
    expect(tooBig.statusCode).toBe(413);
    expect(tooBig.body).toEqual({ error: "This scan is too large to save." });

    const rawFile = mockRes();
    await scans({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.12", "content-type": "application/pdf" },
      url: "/api/beta/scans",
      body: "%PDF",
    }, rawFile);
    expect(rawFile.statusCode).toBe(415);
    expect((rawFile.body as { error: string }).error).toMatch(/JSON/);

    const broken = mockRes();
    await scans({
      method: "POST",
      headers: { "x-real-ip": "203.0.113.12", "content-type": "application/json" },
      url: "/api/beta/scans",
      body: "{",
    }, broken);
    expect(broken.statusCode).toBe(400);
    expect(broken.body).toEqual({ error: "Send scan details as JSON." });
  });

  it("returns JSON when the request URL cannot be parsed", async () => {
    const res = mockRes();
    await scans({
      method: "GET",
      headers: { "x-real-ip": "203.0.113.13" },
      url: "http://[",
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "That request URL is not valid." });
  });

  it("limits bursts per IP with a JSON 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));
    let last = mockRes();
    for (let i = 0; i < 41; i += 1) {
      last = mockRes();
      await scans({
        method: "GET",
        headers: { "x-real-ip": "203.0.113.14" },
        url: "/api/beta/scans",
      }, last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.body).toEqual({ error: "Too many scan requests. Wait a moment and try again." });
    expect(Number(last.header("Retry-After"))).toBeGreaterThan(0);

    const other = mockRes();
    await scans({
      method: "GET",
      headers: { "x-forwarded-for": "198.51.100.8, 10.0.0.1" },
      url: "/api/beta/scans",
    }, other);
    expect(other.statusCode).toBe(200);
  });

  it("turns an unexpected throw into a JSON error and hides the cause", async () => {
    const res = mockRes();
    const req = {
      method: "GET",
      url: "/api/beta/scans",
      get headers() {
        throw new Error("service-role-test leaked");
      },
    };
    await scans(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "The scan request failed. Try again." });
    expect(JSON.stringify(res.body)).not.toContain("service-role-test");
  });
});
