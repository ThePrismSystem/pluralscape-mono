import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstants = vi.hoisted(() => ({
  expoConfig: null as { extra: Record<string, unknown> | undefined } | null,
}));

vi.mock("expo-constants", () => ({
  default: mockConstants,
}));

import { getApiBaseUrl, getWsUrl } from "../config.js";

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

describe("getWsUrl", () => {
  it("converts http to ws and appends /sync", () => {
    mockConstants.expoConfig = { extra: { apiBaseUrl: "http://localhost:3000" } };
    expect(getWsUrl()).toBe("ws://localhost:3000/sync");
  });

  it("converts https to wss and appends /sync", () => {
    mockConstants.expoConfig = { extra: { apiBaseUrl: "https://api.example.com" } };
    expect(getWsUrl()).toBe("wss://api.example.com/sync");
  });
});
