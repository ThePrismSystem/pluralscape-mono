import { afterEach, beforeEach, describe, expect, it } from "vitest";

// config.ts exports functions that call Constants.expoConfig at call time,
// so no vi.resetModules() is needed — each call re-reads the current mock state.
import { getApiBaseUrl, getWsUrl } from "../config";

// The mock is wired via resolve.alias so any import of expo-constants
// resolves to our mock. Import helpers directly.
import * as constants from "./expo-constants-mock";

// React Native's runtime exposes `__DEV__` as a global; vitest (Node) does
// not. Each test opts in by toggling this flag on globalThis so we can
// exercise dev-only and non-dev branches deterministically.
interface GlobalWithDev {
  __DEV__: boolean;
}

function setDev(value: boolean): void {
  (globalThis as Partial<GlobalWithDev>).__DEV__ = value;
}

function clearDev(): void {
  delete (globalThis as Partial<GlobalWithDev>).__DEV__;
}

describe("getApiBaseUrl", () => {
  beforeEach(() => {
    constants.__reset();
    clearDev();
  });

  afterEach(() => {
    constants.__reset();
    clearDev();
  });

  it("returns configured apiBaseUrl when it is an https URL", () => {
    constants.__setConfig({
      extra: { apiBaseUrl: "https://api.pluralscape.org" },
    });
    expect(getApiBaseUrl()).toBe("https://api.pluralscape.org");
  });

  it("returns configured http://localhost URL when running in a dev build", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://localhost:3000" } });
    expect(getApiBaseUrl()).toBe("http://localhost:3000");
  });

  it("permits http://127.0.0.1 in a dev build", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://127.0.0.1:4000" } });
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:4000");
  });

  it("throws when apiBaseUrl is an empty string", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "" } });
    expect(() => getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("throws when apiBaseUrl is not a string", () => {
    constants.__setConfig({ extra: { apiBaseUrl: 42 } });
    expect(() => getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("throws when apiBaseUrl is missing from extra", () => {
    constants.__setConfig({ extra: {} });
    expect(() => getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("throws when extra is undefined", () => {
    constants.__setConfig({ extra: undefined });
    expect(() => getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("throws when expoConfig is null", () => {
    constants.__setConfig(null);
    expect(() => getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("throws when apiBaseUrl uses http:// in a non-dev build", () => {
    setDev(false);
    constants.__setConfig({ extra: { apiBaseUrl: "http://localhost:3000" } });
    expect(() => getApiBaseUrl()).toThrow(/non-development build/);
  });

  it("throws when apiBaseUrl uses http:// in a dev build pointing at a non-loopback host", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://api.pluralscape.app" } });
    expect(() => getApiBaseUrl()).toThrow(/non-loopback host in a dev build/);
  });

  it("throws when apiBaseUrl has an unsupported scheme", () => {
    constants.__setConfig({ extra: { apiBaseUrl: "ftp://example.com" } });
    expect(() => getApiBaseUrl()).toThrow(/unsupported scheme/);
  });

  it("accepts https:// case-insensitively (URL normalizes the scheme)", () => {
    // `new URL(...)` lower-cases the scheme, so "HTTPS://..." is safe to
    // accept. A `startsWith("https://")` check would reject it outright —
    // URL-parse dispatch catches the intent.
    constants.__setConfig({ extra: { apiBaseUrl: "HTTPS://api.example.com" } });
    expect(getApiBaseUrl()).toBe("HTTPS://api.example.com");
  });

  it("rejects http:example.com (missing // authority) as a malformed URL", () => {
    // `"http:example.com"` parses as `{ protocol: "http:", pathname: "example.com" }`
    // with empty host — a startsWith chain would have waved it through as
    // "starts with http:". URL-parse gates on protocol + empty hostname.
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http:example.com" } });
    expect(() => getApiBaseUrl()).toThrow(/non-loopback host in a dev build/);
  });

  it("permits http://[::1] in a dev build (IPv6 loopback)", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://[::1]:3000" } });
    expect(getApiBaseUrl()).toBe("http://[::1]:3000");
  });
});

describe("getWsUrl", () => {
  beforeEach(() => {
    constants.__reset();
    clearDev();
  });

  afterEach(() => {
    constants.__reset();
    clearDev();
  });

  it("converts http loopback base URL to ws in a dev build", () => {
    setDev(true);
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

  it("throws when no config is present (apiBaseUrl required)", () => {
    expect(() => getWsUrl()).toThrow(/apiBaseUrl is not configured/);
  });

  it("permits plaintext ws:// for 127.0.0.1 in a dev build", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://127.0.0.1:4000" } });
    expect(getWsUrl()).toBe("ws://127.0.0.1:4000/sync");
  });

  it("permits plaintext ws:// for IPv6 loopback in a dev build", () => {
    setDev(true);
    constants.__setConfig({ extra: { apiBaseUrl: "http://[::1]:3000" } });
    expect(getWsUrl()).toBe("ws://[::1]:3000/sync");
  });

  it("rejects apiBaseUrl http://non-loopback before WS derivation in non-dev builds", () => {
    setDev(false);
    constants.__setConfig({ extra: { apiBaseUrl: "http://api.pluralscape.app" } });
    expect(() => getWsUrl()).toThrow(/non-development build/);
  });
});
