import { describe, expect, it, vi } from "vitest";

import { sendSignedWebhookRequest } from "../../lib/webhook-fetch.js";

describe("sendSignedWebhookRequest", () => {
  const baseOpts = {
    url: "https://example.com/hook",
    signature: "abc123",
    timestamp: 1_700_000_000,
    payloadJson: '{"test":true}',
  };

  it("returns httpStatus on successful fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    const result = await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });
    expect(result).toEqual({ httpStatus: 200 });
  });

  it("sends correct headers", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0] ?? [];
    const opts = call[1] as RequestInit;
    expect(opts.headers).toMatchObject({
      "X-Pluralscape-Signature": "abc123",
      "X-Pluralscape-Timestamp": "1700000000",
      "Content-Type": "application/json",
    });
  });

  it("includes Host header when hostHeader is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await sendSignedWebhookRequest({
      ...baseOpts,
      fetchFn: mockFetch,
      hostHeader: "original.example.com",
    });

    const call = mockFetch.mock.calls[0] ?? [];
    const opts = call[1] as RequestInit;
    expect(opts.headers).toMatchObject({ Host: "original.example.com" });
  });

  it("does not include Host header when not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });

    const call = mockFetch.mock.calls[0] ?? [];
    const opts = call[1] as RequestInit;
    expect(opts.headers).not.toHaveProperty("Host");
  });

  it("returns network error on TypeError", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const result = await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });
    expect(result).toEqual({ error: "network" });
  });

  it("returns timeout error on AbortError", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });
    expect(result).toEqual({ error: "timeout" });
  });

  it("re-throws unexpected errors", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("unexpected"));
    await expect(sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch })).rejects.toThrow(
      "unexpected",
    );
  });

  it("sends POST with payload body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await sendSignedWebhookRequest({ ...baseOpts, fetchFn: mockFetch });

    const call = mockFetch.mock.calls[0] ?? [];
    const opts = call[1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe('{"test":true}');
  });
});
