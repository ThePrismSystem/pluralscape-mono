import { fetchEventSource } from "@microsoft/fetch-event-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SseClient } from "../sse-client.js";

import type { EventSourceMessage, FetchEventSourceInit } from "@microsoft/fetch-event-source";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockFetchEventSource = vi.mocked(fetchEventSource);

beforeEach(() => {
  mockFetchEventSource.mockReset();
});

describe("SseClient", () => {
  it("connects to the notifications endpoint with Authorization header", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    client.connect("my-token");

    expect(mockFetchEventSource).toHaveBeenCalledOnce();
    const [url, options] = mockFetchEventSource.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("https://example.com/api/v1/notifications/stream");
    expect(options.headers["Authorization"]).toBe("Bearer my-token");
  });

  it("does not include token in the URL", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    client.connect("secret-token");

    const [url] = mockFetchEventSource.mock.calls[0] as [string, unknown];
    expect(url).not.toContain("secret-token");
  });

  it("emits parsed JSON events to listeners", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    const listener = vi.fn();
    client.onEvent(listener);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "1", data: '{"type":"notification"}', event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(listener).toHaveBeenCalledWith({ type: "notification" });
  });

  it("emits raw string data when JSON parse fails", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    const listener = vi.fn();
    client.onEvent(listener);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "2", data: "plain-text", event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(listener).toHaveBeenCalledWith("plain-text");
  });

  it("emits events to multiple listeners", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    const l1 = vi.fn();
    const l2 = vi.fn();
    client.onEvent(l1);
    client.onEvent(l2);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "3", data: '"ping"', event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(l1).toHaveBeenCalledWith("ping");
    expect(l2).toHaveBeenCalledWith("ping");
  });

  it("unsubscribe stops receiving events", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    const listener = vi.fn();
    const off = client.onEvent(listener);
    off();

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "4", data: '"hello"', event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(listener).not.toHaveBeenCalled();
  });

  it("disconnect sets isConnected to false", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    client.connect("tok");
    expect(client.isConnected).toBe(true);
    client.disconnect();
    expect(client.isConnected).toBe(false);
  });

  it("does not call fetchEventSource if already connected", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    client.connect("tok");
    client.connect("tok2");
    expect(mockFetchEventSource).toHaveBeenCalledOnce();
  });

  it("passes an AbortSignal to fetchEventSource", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });
    client.connect("tok");

    const [, options] = mockFetchEventSource.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("includes Last-Event-ID header after reconnect when onclose clears controller", () => {
    const client = new SseClient({ baseUrl: "https://example.com" });

    mockFetchEventSource.mockImplementationOnce((_url: RequestInfo, opts: FetchEventSourceInit) => {
      const msg: EventSourceMessage = { id: "evt-42", data: '"data"', event: "", retry: undefined };
      opts.onmessage?.(msg);
      opts.onclose?.();
      return Promise.resolve();
    });

    client.connect("tok");

    client.connect("tok");
    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
    const secondCall = mockFetchEventSource.mock.calls[1] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(secondCall[1].headers["Last-Event-ID"]).toBe("evt-42");
  });
});
