import { describe, expect, it } from "vitest";

import { isOriginAllowed } from "../../lib/origin-matcher.js";

describe("isOriginAllowed", () => {
  // ── Exact matches ────────────────────────────────────────────────

  it("matches an exact origin", () => {
    expect(isOriginAllowed("https://app.example.com", ["https://app.example.com"])).toBe(true);
  });

  it("rejects origin not in allowlist", () => {
    expect(isOriginAllowed("https://evil.com", ["https://app.example.com"])).toBe(false);
  });

  it("returns false for empty allowlist", () => {
    expect(isOriginAllowed("https://app.example.com", [])).toBe(false);
  });

  it("is case-sensitive for exact matches", () => {
    expect(isOriginAllowed("https://APP.example.com", ["https://app.example.com"])).toBe(false);
  });

  // ── Wildcard matches ─────────────────────────────────────────────

  it("matches subdomain with wildcard pattern", () => {
    expect(isOriginAllowed("https://app.example.com", ["*.example.com"])).toBe(true);
  });

  it("matches deep subdomain with wildcard pattern", () => {
    expect(isOriginAllowed("https://a.b.c.example.com", ["*.example.com"])).toBe(true);
  });

  it("matches http scheme with wildcard", () => {
    expect(isOriginAllowed("http://app.example.com", ["*.example.com"])).toBe(true);
  });

  it("rejects bare domain against wildcard (no subdomain)", () => {
    expect(isOriginAllowed("https://example.com", ["*.example.com"])).toBe(false);
  });

  it("rejects suffix injection (evilexample.com vs *.example.com)", () => {
    expect(isOriginAllowed("https://evilexample.com", ["*.example.com"])).toBe(false);
  });

  it("rejects suffix injection subdomain (sub.evilexample.com)", () => {
    expect(isOriginAllowed("https://sub.evilexample.com", ["*.example.com"])).toBe(false);
  });

  // ── Mixed allowlist ──────────────────────────────────────────────

  it("matches when one of multiple patterns matches", () => {
    const allowlist = ["https://exact.com", "*.example.com"];
    expect(isOriginAllowed("https://exact.com", allowlist)).toBe(true);
    expect(isOriginAllowed("https://app.example.com", allowlist)).toBe(true);
    expect(isOriginAllowed("https://other.com", allowlist)).toBe(false);
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it("rejects invalid origin URL gracefully", () => {
    expect(isOriginAllowed("not-a-url", ["*.example.com"])).toBe(false);
  });

  it("handles origin with port", () => {
    expect(isOriginAllowed("https://app.example.com:8443", ["*.example.com"])).toBe(true);
  });

  it("handles origin with path (URL constructor ignores path for hostname)", () => {
    expect(isOriginAllowed("https://app.example.com/path", ["*.example.com"])).toBe(true);
  });
});
