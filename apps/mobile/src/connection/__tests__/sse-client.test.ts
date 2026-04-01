import { fetchEventSource } from "@microsoft/fetch-event-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SseClient } from "../sse-client.js";

import type { SseLifecycleCallbacks } from "../connection-types.js";
import type { EventSourceMessage, FetchEventSourceInit } from "@microsoft/fetch-event-source";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockFetchEventSource = vi.mocked(fetchEventSource);

function makeCallbacks(): SseLifecycleCallbacks {
  return {
    onConnected: vi.fn(),
    onDisconnected: vi.fn(),
    onError: vi.fn(),
  };
}

beforeEach(() => {
  mockFetchEventSource.mockReset();
});

describe("SseClient", () => {
  it("connects to the notifications endpoint with Authorization header", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
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
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
    client.connect("secret-token");

    const [url] = mockFetchEventSource.mock.calls[0] as [string, unknown];
    expect(url).not.toContain("secret-token");
  });

  it("emits parsed JSON events wrapped in SseEvent to listeners", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
    const listener = vi.fn();
    client.onEvent(listener);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "1", data: '{"type":"notification"}', event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(listener).toHaveBeenCalledWith({ type: "message", data: { type: "notification" } });
  });

  it("drops malformed JSON instead of passing to listeners", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      { onConnected: vi.fn(), onDisconnected: vi.fn(), onError },
    );
    const listener = vi.fn();
    client.onEvent(listener);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "2", data: "plain-text", event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(listener).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("emits events to multiple listeners", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
    const l1 = vi.fn();
    const l2 = vi.fn();
    client.onEvent(l1);
    client.onEvent(l2);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "3", data: '"ping"', event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(l1).toHaveBeenCalledWith({ type: "message", data: "ping" });
    expect(l2).toHaveBeenCalledWith({ type: "message", data: "ping" });
  });

  it("unsubscribe stops receiving events", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
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
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());

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
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
    client.connect("tok");
    client.connect("tok2");
    expect(mockFetchEventSource).toHaveBeenCalledOnce();
  });

  it("passes an AbortSignal to fetchEventSource", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());
    client.connect("tok");

    const [, options] = mockFetchEventSource.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("includes Last-Event-ID header after reconnect when onclose clears controller", () => {
    const client = new SseClient({ baseUrl: "https://example.com" }, makeCallbacks());

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

  it("invokes onConnected callback on open", () => {
    const onConnected = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      {
        onConnected,
        onDisconnected: vi.fn(),
        onError: vi.fn(),
      },
    );

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    client.connect("tok");
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it("invokes onError callback on error", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      {
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError,
      },
    );
    const error = new Error("connection failed");

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      try {
        opts.onerror?.(error);
      } catch {
        // Expected throw
      }
      return Promise.resolve();
    });

    client.connect("tok");
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("onerror throws to prevent fetchEventSource built-in retry", () => {
    const callbacks = makeCallbacks();
    const client = new SseClient({ baseUrl: "https://example.com" }, callbacks);
    const error = new Error("connection failed");

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      expect(() => opts.onerror?.(error)).toThrow(error);
      return Promise.resolve();
    });

    client.connect("tok");
  });

  it("onerror wraps non-Error values in an Error before throwing", () => {
    const callbacks = makeCallbacks();
    const client = new SseClient({ baseUrl: "https://example.com" }, callbacks);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      expect(() => opts.onerror?.("string-error")).toThrow(Error);
      return Promise.resolve();
    });

    client.connect("tok");
    const thrownErr = (callbacks.onError as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Error;
    expect(thrownErr).toBeInstanceOf(Error);
    expect(thrownErr.message).toBe("string-error");
  });

  it("onerror cleans up abortController so connect is not blocked", () => {
    const callbacks = makeCallbacks();
    const client = new SseClient({ baseUrl: "https://example.com" }, callbacks);

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      try {
        opts.onerror?.(new Error("fail"));
      } catch {
        // Expected throw
      }
      return Promise.resolve();
    });

    client.connect("tok");
    expect(client.isConnected).toBe(false);

    mockFetchEventSource.mockImplementation(() => Promise.resolve());
    client.connect("tok2");
    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
  });

  it("propagates malformed JSON to onError callback with raw payload excerpt", () => {
    const onError = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      { onConnected: vi.fn(), onDisconnected: vi.fn(), onError },
    );

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onmessage?.({ id: "5", data: "not-json{", event: "", retry: undefined });
      return Promise.resolve();
    });

    client.connect("tok");
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    const errorArg = onError.mock.calls[0]?.[0] as Error;
    expect(errorArg.message).toContain("Malformed SSE JSON payload");
    expect(errorArg.message).toContain("not-json{");
  });

  it("invokes onDisconnected callback on close", () => {
    const onDisconnected = vi.fn();
    const client = new SseClient(
      { baseUrl: "https://example.com" },
      {
        onConnected: vi.fn(),
        onDisconnected,
        onError: vi.fn(),
      },
    );

    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      opts.onclose?.();
      return Promise.resolve();
    });

    client.connect("tok");
    expect(onDisconnected).toHaveBeenCalledOnce();
  });
});
