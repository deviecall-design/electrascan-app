import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import handler, {
  LIMITS,
  redactSecrets,
  resetDetectRateLimit,
  validateDetectRequest,
} from "../api/detect.js";

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_RATE_MAX = LIMITS.rateMax;

function mockRes() {
  const res: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    setHeader: (k: string, v: string) => void;
    status: (code: number) => typeof res;
    json: (obj: unknown) => typeof res;
    send: (text: string) => typeof res;
  } = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    send(text) {
      this.body = text;
      return this;
    },
  };
  return res;
}

const validBody = {
  model: "claude-sonnet-5",
  max_tokens: 16000,
  system: "You are ElectraScan",
  messages: [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "aaaa" } },
        { type: "text", text: "Drawing: plan.pdf. Read the legend." },
      ],
    },
  ],
  tools: [{ name: "should-not-forward" }],
};

describe("detect proxy validation", () => {
  it("keeps the scanner payload and drops extra fields", () => {
    const result = validateDetectRequest(validBody);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: "You are ElectraScan",
      messages: validBody.messages,
    });
    expect(result.payload).not.toHaveProperty("tools");
  });

  it("rejects a model outside the allow-list", () => {
    const result = validateDetectRequest({ ...validBody, model: "claude-anything" });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects too many pages", () => {
    const images = Array.from({ length: LIMITS.maxImages + 1 }, () => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "aaaa" },
    }));
    const result = validateDetectRequest({
      ...validBody,
      messages: [{ role: "user", content: images }],
    });
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects remote image URLs", () => {
    const result = validateDetectRequest({
      ...validBody,
      messages: [{
        role: "user",
        content: [{ type: "image", source: { type: "url", url: "https://example.test/a.png" } }],
      }],
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("redacts key-shaped text from upstream errors", () => {
    const cleaned = redactSecrets("bad request sk-ant-api03-not-a-real-key-value-at-all extra");
    expect(cleaned).not.toContain("sk-ant-");
    expect(cleaned).toContain("[redacted]");
  });
});

describe("POST /api/detect", () => {
  beforeEach(() => {
    resetDetectRateLimit();
    process.env.ANTHROPIC_API_KEY = "test-server-key";
    LIMITS.rateMax = ORIGINAL_RATE_MAX;
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
    LIMITS.rateMax = ORIGINAL_RATE_MAX;
    vi.unstubAllGlobals();
  });

  it("requires a signed-in caller", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: validBody }, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an oversized body before calling upstream", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = mockRes();
    await handler({
      method: "POST",
      headers: { authorization: "Bearer token", "content-length": String(LIMITS.maxBodyBytes + 1) },
      body: validBody,
    }, res);
    expect(res.statusCode).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards a cleaned payload and does not return the server key", async () => {
    let upstream: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
      }
      upstream = {
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: JSON.parse(String(init?.body)),
      };
      return new Response(JSON.stringify({
        id: "msg_1",
        type: "message",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "{\"legend_found\":true,\"items\":[]}" }],
      }), { status: 200 });
    });

    const res = mockRes();
    await handler({
      method: "POST",
      headers: { authorization: "Bearer session-token" },
      body: validBody,
    }, res);

    expect(res.statusCode).toBe(200);
    expect(upstream).not.toBeNull();
    expect(upstream!.headers["x-api-key"]).toBe("test-server-key");
    expect(upstream!.body).not.toHaveProperty("tools");
    expect(String(res.body)).not.toContain("test-server-key");
    expect(String(res.body)).toContain("legend_found");
  });

  it("rate-limits a signed-in caller", async () => {
    LIMITS.rateMax = 2;
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    let last = mockRes();
    for (let i = 0; i < 3; i++) {
      last = mockRes();
      await handler({
        method: "POST",
        headers: { authorization: "Bearer session-token" },
        body: validBody,
      }, last);
    }
    expect(last.statusCode).toBe(429);
    expect(last.headers["Retry-After"]).toBeTruthy();
  });

  it("reports a missing server key without calling Anthropic", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
      }
      throw new Error("upstream should not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = mockRes();
    await handler({
      method: "POST",
      headers: { authorization: "Bearer session-token" },
      body: validBody,
    }, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).toContain("ANTHROPIC_API_KEY");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("client bundle sources", () => {
  it("does not read a browser Anthropic key or call the API from the scanner", () => {
    const scanner = readFileSync(path.join(process.cwd(), "analyze_pdf.ts"), "utf8");
    const example = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(scanner).not.toMatch(/VITE_ANTHROPIC_API_KEY/);
    expect(scanner).not.toMatch(/NEXT_PUBLIC_ANTHROPIC/);
    expect(scanner).not.toMatch(/dangerouslyAllowBrowser/);
    expect(scanner).not.toMatch(/sk-ant-/);
    expect(scanner).toContain('fetch("/api/detect"');
    expect(example).not.toMatch(/VITE_ANTHROPIC_API_KEY/);
    expect(example).toMatch(/^ANTHROPIC_API_KEY=$/m);
  });
});
