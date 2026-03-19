import { afterEach, describe, expect, it, vi } from "vitest";

import { isAllowedOrigin } from "../../ws/origin-validation.js";

describe("isAllowedOrigin", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });

  it("returns true in test environment", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(isAllowedOrigin("https://evil.example")).toBe(true);
  });

  it("returns true in development environment", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isAllowedOrigin("https://evil.example")).toBe(true);
  });

  it("returns true when origin is undefined (non-browser client)", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it("returns true when origin is in ALLOWED_ORIGINS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "https://app.example.com,https://staging.example.com");
    expect(isAllowedOrigin("https://app.example.com")).toBe(true);
  });

  it("returns false when origin is not in ALLOWED_ORIGINS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "https://app.example.com");
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });

  it("returns false when ALLOWED_ORIGINS is empty", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "");
    expect(isAllowedOrigin("https://app.example.com")).toBe(false);
  });

  it("returns false when ALLOWED_ORIGINS is not set", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env["ALLOWED_ORIGINS"];
    expect(isAllowedOrigin("https://app.example.com")).toBe(false);
  });

  it("trims whitespace from ALLOWED_ORIGINS entries", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOWED_ORIGINS", "https://a.com, https://b.com , https://c.com");
    expect(isAllowedOrigin("https://b.com")).toBe(true);
  });
});
