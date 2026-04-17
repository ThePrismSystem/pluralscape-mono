import { fetchEventSource } from "@microsoft/fetch-event-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SseClient } from "../sse-client.js";

import type { FetchEventSourceInit } from "@microsoft/fetch-event-source";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockFetchEventSource = vi.mocked(fetchEventSource);

beforeEach(() => {
  mockFetchEventSource.mockReset();
});

describe("SseClient error payload redaction (MOBILE-S-L2)", () => {
  it("does not embed malformed payload content in the Error surfaced to onError", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      { onConnected: vi.fn(), onDisconnected: vi.fn(), onError },
    );

    // Distinctive marker to prove the raw payload does not leak through the
    // error message. Represents an attacker-controlled or secret-bearing
    // payload the server might mis-emit.
    const sensitivePayload = "super-secret-token-abc123-DO-NOT-LEAK";

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "x", data: sensitivePayload, event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");

    expect(onError).toHaveBeenCalledOnce();
    const errorArg = onError.mock.calls[0]?.[0] as Error;
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).not.toContain(sensitivePayload);
    expect(errorArg.message).not.toContain("super-secret-token");
    expect(errorArg.stack ?? "").not.toContain(sensitivePayload);
  });

  it("keeps a generic error category so callers can still distinguish malformed-payload failures", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      { onConnected: vi.fn(), onDisconnected: vi.fn(), onError },
    );

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "y", data: "{not-json", event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    const errorArg = onError.mock.calls[0]?.[0] as Error;
    expect(errorArg.message).toMatch(/malformed sse/i);
  });

  it("long payloads (>200 chars) are still redacted — no excerpt slice leaks", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      { onConnected: vi.fn(), onDisconnected: vi.fn(), onError },
    );

    const longSecret = `prefix-${"x".repeat(500)}-suffix-SHHH`;

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "z", data: longSecret, event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    const errorArg = onError.mock.calls[0]?.[0] as Error;
    expect(errorArg.message).not.toContain("prefix-");
    expect(errorArg.message).not.toContain("suffix-SHHH");
    expect(errorArg.message.length).toBeLessThan(64);
  });
});
