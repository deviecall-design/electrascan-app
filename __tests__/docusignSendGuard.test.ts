import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "http";
import {
  envelopeSendBlockReason,
  isFixtureEstimateRef,
  isPlaceholderEstimatePdf,
} from "../lib/docusignSendGuard";
import handler from "../api/docusign/envelope";

const PLACEHOLDER_PREFIX =
  "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIK";

describe("envelopeSendBlockReason", () => {
  it("blocks a signed-out user before a sample envelope", () => {
    expect(
      envelopeSendBlockReason({
        signedIn: false,
        sample: true,
        estimateRef: "EST-2609-0001",
        documentBase64: PLACEHOLDER_PREFIX,
      }),
    ).toMatch(/sign in/i);
  });

  it("blocks sample data even when the user is signed in", () => {
    expect(
      envelopeSendBlockReason({
        signedIn: true,
        sample: true,
        estimateRef: "EST-2610-0004",
        documentBase64: "cmVhbC1wZGY=",
      }),
    ).toMatch(/sample data/i);
  });

  it("blocks an omitted sample flag and the placeholder PDF", () => {
    expect(
      envelopeSendBlockReason({
        signedIn: true,
        estimateRef: "EST-2610-0004",
        documentBase64: "cmVhbC1wZGY=",
      }),
    ).toMatch(/sample data/i);

    expect(
      envelopeSendBlockReason({
        signedIn: true,
        sample: false,
        estimateRef: "EST-2610-0004",
        documentBase64: `${PLACEHOLDER_PREFIX}rest`,
      }),
    ).toMatch(/placeholder/i);
  });

  it("blocks retired fixture references", () => {
    expect(isFixtureEstimateRef("EST-2026-497")).toBe(true);
    expect(
      envelopeSendBlockReason({
        signedIn: true,
        sample: false,
        estimateRef: "EST-2026-497",
        documentBase64: "cmVhbC1wZGY=",
      }),
    ).toMatch(/sample data/i);
    expect(isPlaceholderEstimatePdf("not-a-pdf")).toBe(false);
  });

  it("allows a signed-in send of a saved, non-placeholder estimate", () => {
    expect(
      envelopeSendBlockReason({
        signedIn: true,
        sample: false,
        estimateRef: "EST-2610-0004",
        documentBase64: "cmVhbC1wZGY=",
      }),
    ).toBeNull();
  });
});

function mockRes() {
  const res = {
    statusCode: 0,
    body: "",
    headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) {
      this.headers[key] = value;
    },
    writeHead(code: number, headers?: Record<string, unknown>) {
      this.statusCode = code;
      if (headers) Object.assign(this.headers, headers);
    },
    end(body?: string) {
      this.body = body ?? "";
    },
  };
  return res;
}

async function invoke(headers: Record<string, string>, body?: unknown) {
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  const listeners: Record<string, Array<(chunk?: Buffer) => void>> = {};
  const req = {
    method: "POST",
    headers,
    on(event: string, cb: (chunk?: Buffer) => void) {
      (listeners[event] ??= []).push(cb);
      if (encoded !== undefined && listeners.data && listeners.end) {
        queueMicrotask(() => {
          listeners.data.forEach(fn => fn(Buffer.from(encoded)));
          listeners.end.forEach(fn => fn());
        });
      }
    },
  };
  const res = mockRes();
  await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  return res;
}

const fetchMock = vi.fn();

describe("POST /api/docusign/envelope", () => {
  const previousAnon = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.SUPABASE_ANON_KEY = "test-anon-key";
    delete process.env.DOCUSIGN_PRIVATE_KEY;
  });

  afterEach(() => {
    process.env.SUPABASE_ANON_KEY = previousAnon;
    vi.unstubAllGlobals();
  });

  it("does not call DocuSign when the caller is signed out", async () => {
    const res = await invoke({});
    expect(res.statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.body).toMatch(/sign in/i);
  });

  it("does not call DocuSign for a sample or placeholder document", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "user-1" }),
    });
    const res = await invoke(
      { authorization: "Bearer session-token" },
      {
        signerEmail: "j.caldwell@caldwellbuilds.com.au",
        signerName: "James Caldwell",
        estimateRef: "EST-2609-0001",
        projectName: "Toorak Residential Stage 2",
        estimateValue: 187450,
        documentBase64: `${PLACEHOLDER_PREFIX}rest-of-placeholder`,
        sample: true,
      },
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatch(/sample data/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/v1/user");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("docusign");
  });

  it("rejects a signed-in caller when the estimate is not saved on their account", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/auth/v1/user")) {
        return { ok: true, json: async () => ({ id: "user-1" }) };
      }
      if (String(url).includes("/rest/v1/estimates")) {
        return { ok: true, json: async () => [] };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const res = await invoke(
      { authorization: "Bearer session-token" },
      {
        signerEmail: "builder@example.com",
        signerName: "Builder",
        estimateRef: "EST-2610-0099",
        projectName: "Real job",
        estimateValue: 1200,
        documentBase64: "cmVhbC1lc3RpbWF0ZS1wZGY=",
        sample: false,
      },
    );
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatch(/saved estimate/i);
    expect(fetchMock.mock.calls.some(call => String(call[0]).includes("docusign"))).toBe(false);
  });
});
