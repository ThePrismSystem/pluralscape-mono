import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../index.js";

// Intercept the final fetch call made by the retry middleware.
// openapi-fetch uses global fetch internally, so we mock it.
const fetchSpy = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeResponse(status: number, headers?: Record<string, string>): Response {
  return new Response(status === 200 ? '{"ok":true}' : '{"error":"rate limited"}', {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("REST client 429 retry middleware", () => {
  it("retries once on 429 and returns the retry response", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(makeResponse(200));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    const result = await client.GET("/api/v1/health" as never);
    expect(result.response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("parses Retry-After header as seconds delay", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(makeResponse(200));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    const start = Date.now();
    await client.GET("/api/v1/health" as never);
    const elapsed = Date.now() - start;
    // Should have waited ~2000ms (allow tolerance for test execution)
    expect(elapsed).toBeGreaterThanOrEqual(1800);
  });

  it("falls back to default delay when Retry-After is non-numeric", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }))
      .mockResolvedValueOnce(makeResponse(200));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    await client.GET("/api/v1/health" as never);
    // Should not throw; should retry with default delay
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-429 responses", async () => {
    fetchSpy.mockResolvedValueOnce(makeResponse(500));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    const result = await client.GET("/api/v1/health" as never);
    expect(result.response.status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 429 when retry also returns 429 (no infinite loop)", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "0" }))
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "0" }));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    const result = await client.GET("/api/v1/health" as never);
    expect(result.response.status).toBe(429);
    // Only 2 fetches: original + 1 retry, NOT infinite
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns original 429 response when retry fetch throws", async () => {
    fetchSpy
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "0" }))
      .mockRejectedValueOnce(new Error("network error"));

    const client = createApiClient({
      baseUrl: "http://localhost:3000",
      getToken: () => "token",
    });

    const result = await client.GET("/api/v1/health" as never);
    expect(result.response.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
