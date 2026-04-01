import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstants = vi.hoisted(() => ({
  expoConfig: null as { extra: Record<string, unknown> | undefined } | null,
}));

vi.mock("expo-constants", () => ({
  default: mockConstants,
}));

import { getApiBaseUrl } from "../config.js";

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    mockConstants.expoConfig = { extra: {} };
  });

  it("returns configured apiBaseUrl when present", () => {
    mockConstants.expoConfig = { extra: { apiBaseUrl: "https://api.pluralscape.org" } };
    expect(getApiBaseUrl()).toBe("https://api.pluralscape.org");
  });

  it("returns DEV fallback for empty string apiBaseUrl", () => {
    mockConstants.expoConfig = { extra: { apiBaseUrl: "" } };
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("returns DEV fallback when extra is missing", () => {
    mockConstants.expoConfig = { extra: undefined };
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("returns DEV fallback when expoConfig is null", () => {
    mockConstants.expoConfig = null;
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });
});
