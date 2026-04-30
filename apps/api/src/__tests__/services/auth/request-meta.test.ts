/**
 * Unit tests for lib/request-meta.ts (auth-context helpers)
 *
 * Covers: extractIpAddress, extractUserAgent, extractPlatform.
 * These live in request-meta.ts but were originally exercised via auth.service.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
}));

vi.mock("../../../env.js", () => ({ env: mockEnv }));

import { extractIpAddress, extractPlatform, extractUserAgent } from "../../../lib/request-meta.js";
import { CLIENT_PLATFORM_HEADER, DEFAULT_PLATFORM } from "../../../routes/auth/auth.constants.js";

import type { Context } from "hono";

/** Build a minimal mock Hono context with the given headers. */
function mockContext(headers: Record<string, string> = {}): Context {
  const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    req: {
      header(name: string) {
        return headerMap.get(name.toLowerCase());
      },
    },
  } as Context;
}

// ── extractIpAddress ───────────────────────────────────────────────────

describe("extractIpAddress", () => {
  afterEach(() => {
    mockEnv.TRUST_PROXY = false;
  });

  it("returns null when TRUST_PROXY is not set", () => {
    mockEnv.TRUST_PROXY = false;
    const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
    expect(extractIpAddress(c)).toBeNull();
  });

  it("returns null when TRUST_PROXY is false", () => {
    mockEnv.TRUST_PROXY = false;
    const c = mockContext({ "x-forwarded-for": "1.2.3.4" });
    expect(extractIpAddress(c)).toBeNull();
  });

  it("returns the first IP from x-forwarded-for when TRUST_PROXY=true", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(extractIpAddress(c)).toBe("1.2.3.4");
  });

  it("returns a single IP from x-forwarded-for when TRUST_PROXY=true", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "10.0.0.1" });
    expect(extractIpAddress(c)).toBe("10.0.0.1");
  });

  it("trims whitespace from the extracted IP", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" });
    expect(extractIpAddress(c)).toBe("192.168.1.1");
  });

  it("returns null when TRUST_PROXY=true but x-forwarded-for is missing", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({});
    expect(extractIpAddress(c)).toBeNull();
  });

  it("returns null when TRUST_PROXY=true and x-forwarded-for is empty", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "" });
    expect(extractIpAddress(c)).toBeNull();
  });

  it("returns null when TRUST_PROXY=true and x-forwarded-for is not a valid IP", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "not-an-ip-address" });
    expect(extractIpAddress(c)).toBeNull();
  });

  it("returns null when TRUST_PROXY=true and x-forwarded-for contains script injection", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "<script>alert(1)</script>" });
    expect(extractIpAddress(c)).toBeNull();
  });

  it("accepts valid IPv6 from x-forwarded-for when TRUST_PROXY=true", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "::1" });
    expect(extractIpAddress(c)).toBe("::1");
  });

  it("returns null when TRUST_PROXY=true and x-forwarded-for contains only whitespace", () => {
    mockEnv.TRUST_PROXY = true;
    const c = mockContext({ "x-forwarded-for": "   " });
    expect(extractIpAddress(c)).toBeNull();
  });
});

// ── extractUserAgent ───────────────────────────────────────────────────

describe("extractUserAgent", () => {
  it("returns the user-agent header when present", () => {
    const c = mockContext({ "user-agent": "Mozilla/5.0 TestBrowser" });
    expect(extractUserAgent(c)).toBe("Mozilla/5.0 TestBrowser");
  });

  it("returns null when user-agent header is missing", () => {
    const c = mockContext({});
    expect(extractUserAgent(c)).toBeNull();
  });

  it("returns the exact value without trimming", () => {
    const c = mockContext({ "user-agent": "  spaced-agent  " });
    expect(extractUserAgent(c)).toBe("  spaced-agent  ");
  });
});

// ── extractPlatform ────────────────────────────────────────────────────

describe("extractPlatform", () => {
  it("returns 'web' when header is 'web'", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "web" });
    expect(extractPlatform(c)).toBe("web");
  });

  it("returns 'mobile' when header is 'mobile'", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "mobile" });
    expect(extractPlatform(c)).toBe("mobile");
  });

  it("returns default platform when header is missing", () => {
    const c = mockContext({});
    expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
  });

  it("returns default platform for invalid header value", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "desktop" });
    expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
  });

  it("returns default platform for empty header", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "" });
    expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
  });

  it("is case-sensitive — 'Web' is not valid", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "Web" });
    expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
  });

  it("is case-sensitive — 'MOBILE' is not valid", () => {
    const c = mockContext({ [CLIENT_PLATFORM_HEADER]: "MOBILE" });
    expect(extractPlatform(c)).toBe(DEFAULT_PLATFORM);
  });
});
