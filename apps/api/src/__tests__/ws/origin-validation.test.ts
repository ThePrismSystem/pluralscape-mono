import { afterEach, describe, expect, it, vi } from "vitest";

import { isAllowedOrigin } from "../../ws/origin-validation.js";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  ALLOWED_ORIGINS: undefined as string | undefined,
}));

vi.mock("../../env.js", () => ({ env: mockEnv }));

describe("isAllowedOrigin", () => {
  afterEach(() => {
    mockEnv.NODE_ENV = "test";
    mockEnv.ALLOWED_ORIGINS = undefined;
  });

  it("returns true in test environment", () => {
    mockEnv.NODE_ENV = "test";
    expect(isAllowedOrigin("https://evil.example")).toBe(true);
  });

  it("returns true in development environment", () => {
    mockEnv.NODE_ENV = "development";
    expect(isAllowedOrigin("https://evil.example")).toBe(true);
  });

  it("returns true when origin is undefined (non-browser client)", () => {
    mockEnv.NODE_ENV = "production";
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it("returns true when origin is in ALLOWED_ORIGINS", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "https://app.example.com,https://staging.example.com";
    expect(isAllowedOrigin("https://app.example.com")).toBe(true);
  });

  it("returns false when origin is not in ALLOWED_ORIGINS", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "https://app.example.com";
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });

  it("returns false when ALLOWED_ORIGINS is empty", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "";
    expect(isAllowedOrigin("https://app.example.com")).toBe(false);
  });

  it("returns false when ALLOWED_ORIGINS is not set", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = undefined;
    expect(isAllowedOrigin("https://app.example.com")).toBe(false);
  });

  it("trims whitespace from ALLOWED_ORIGINS entries", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "https://a.com, https://b.com , https://c.com";
    expect(isAllowedOrigin("https://b.com")).toBe(true);
  });

  // ── Wildcard support ──────────────────────────────────────────

  it("matches wildcard origin pattern", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "*.example.com";
    expect(isAllowedOrigin("https://app.example.com")).toBe(true);
  });

  it("rejects bare domain against wildcard", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "*.example.com";
    expect(isAllowedOrigin("https://example.com")).toBe(false);
  });

  it("rejects suffix injection against wildcard", () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.ALLOWED_ORIGINS = "*.example.com";
    expect(isAllowedOrigin("https://evilexample.com")).toBe(false);
  });
});
