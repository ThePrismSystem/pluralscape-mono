import { afterEach, beforeEach, describe, expect, it } from "vitest";

// config.ts exports functions that call Constants.expoConfig at call time,
// so no vi.resetModules() is needed — each call re-reads the current mock state.
import { getApiBaseUrl, getWsUrl } from "../config";

// The mock is wired via resolve.alias so any import of expo-constants
// resolves to our mock. Import helpers directly.
import * as constants from "./expo-constants-mock";

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    constants.__reset();
  });

  afterEach(() => {
    constants.__reset();
  });

  it("returns configured apiBaseUrl when present in extra", () => {
    constants.__setConfig({
      extra: { apiBaseUrl: "https://api.pluralscape.org" },
    });
    expect(getApiBaseUrl()).toBe("https://api.pluralscape.org");
  });

  it("falls back to DEV_API_BASE_URL when apiBaseUrl is an empty string", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "" } });
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to DEV_API_BASE_URL when apiBaseUrl is not a string", () => {
    constants.__setConfig({ extra: { apiBaseUrl: 42 } });
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to DEV_API_BASE_URL when apiBaseUrl is missing from extra", () => {
    constants.__setConfig({ extra: {} });
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to DEV_API_BASE_URL when extra is undefined", () => {
    constants.__setConfig({ extra: undefined });
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("falls back to DEV_API_BASE_URL when expoConfig is null", () => {
    constants.__setConfig(null);
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("getWsUrl", () => {
  beforeEach(() => {
    constants.__reset();
  });

  afterEach(() => {
    constants.__reset();
  });

  it("converts http base URL to ws and appends /sync", () => {
    constants.__setConfig({
      extra: { apiBaseUrl: "http://localhost:3000" },
    });
    expect(getWsUrl()).toBe("ws://localhost:3000/sync");
  });

  it("converts https base URL to wss and appends /sync", () => {
    constants.__setConfig({
      extra: { apiBaseUrl: "https://api.example.com" },
    });
    expect(getWsUrl()).toBe("wss://api.example.com/sync");
  });

  it("uses dev fallback ws URL when no config present", () => {
    expect(getWsUrl()).toBe("ws://localhost:3000/sync");
  });

  it("permits plaintext ws:// for 127.0.0.1", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "http://127.0.0.1:4000" } });
    expect(getWsUrl()).toBe("ws://127.0.0.1:4000/sync");
  });

  it("permits plaintext ws:// for IPv6 loopback", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "http://[::1]:3000" } });
    expect(getWsUrl()).toBe("ws://[::1]:3000/sync");
  });

  it("throws when apiBaseUrl is http:// pointing at a non-loopback host", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "http://api.pluralscape.app" } });
    expect(() => getWsUrl()).toThrow(/plaintext WebSocket to a non-loopback host/);
  });

  it("throws when apiBaseUrl is a malformed http URL", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "http://" } });
    expect(() => getWsUrl()).toThrow(/plaintext WebSocket to a non-loopback host/);
  });
});
