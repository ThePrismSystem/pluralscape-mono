import { fetchEventSource } from "@microsoft/fetch-event-source";
import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";

import type { FetchEventSourceInit } from "@microsoft/fetch-event-source";
import type { SystemId } from "@pluralscape/types";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockFetchEventSource = vi.mocked(fetchEventSource);

function makeManager(): ConnectionManager {
  return new ConnectionManager({ baseUrl: "https://example.com" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConnectionManager", () => {
  it("starts in disconnected state", () => {
    const manager = makeManager();
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("transitions to connecting (not connected) when connect is called", () => {
    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connecting");
  });

  it("transitions to connected only after SSE onopen fires", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connected");
  });

  it("disconnects when disconnect is called after being connected", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connected");
    manager.disconnect();
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("disconnects when disconnect is called after being connected (unauthenticated path)", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    manager.disconnect();
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("notifies subscribers when state changes", () => {
    const manager = makeManager();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(listener).toHaveBeenCalled();
  });

  it("unsubscribe stops notifications", () => {
    const manager = makeManager();
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("explicit disconnect moves to disconnected from any state", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    manager.disconnect();
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("handles connection lost from SSE error", () => {
    const sseError = new Error("SSE failed");
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      try {
        opts.onerror?.(sseError);
      } catch {
        // Expected throw — onerror throws to prevent fetchEventSource built-in retry
      }
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    // After onopen -> connected, then onerror -> handleConnectionLost
    // connected -> CONNECTION_LOST -> reconnecting (backoff timer scheduled)
    expect(manager.getSnapshot()).toBe("reconnecting");
  });

  it("completes the reconnect cycle after connection lost from connected", () => {
    vi.useFakeTimers();

    let sseCallbacks: FetchEventSourceInit | undefined;
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      sseCallbacks = opts;
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connected");

    // Simulate connection lost — schedules backoff then reconnect
    expect(sseCallbacks).toBeDefined();
    try {
      sseCallbacks?.onerror?.(new Error("connection dropped"));
    } catch {
      // Expected throw — onerror throws to prevent fetchEventSource built-in retry
    }
    expect(manager.getSnapshot()).toBe("reconnecting");

    // Advance past max possible jittered backoff (baseBackoffMs * 2^retryCount * JITTER_MAX = 1000 * 2^1 * 1.25)
    vi.advanceTimersByTime(3_000);
    expect(manager.getSnapshot()).toBe("connected");

    vi.useRealTimers();
  });

  it("completes the backoff-then-reconnect cycle from connecting state", () => {
    vi.useFakeTimers();

    // First connection attempt fails immediately
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      try {
        opts.onerror?.(new Error("refused"));
      } catch {
        // Expected throw — onerror throws to prevent fetchEventSource built-in retry
      }
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    // connecting -> CONNECTION_LOST -> backoff
    expect(manager.getSnapshot()).toBe("backoff");

    // After backoff, should reconnect
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    vi.advanceTimersByTime(3_000); // past max possible jittered backoff (1000 * 2^1 * 1.25)
    expect(manager.getSnapshot()).toBe("connected");

    vi.useRealTimers();
  });

  it("does not reconnect after disconnect during backoff delay", () => {
    vi.useFakeTimers();

    // Start connected
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connected");

    // Trigger connection lost to enter backoff/reconnecting
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      try {
        opts.onerror?.(new Error("lost"));
      } catch {
        // onerror throws to prevent fetchEventSource retry
      }
      return Promise.resolve();
    });

    // Disconnect and reconnect to trigger connection lost
    manager.disconnect();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    // Now connecting — trigger error to enter backoff
    expect(manager.getSnapshot()).toBe("backoff");

    // Disconnect during backoff
    manager.disconnect();
    expect(manager.getSnapshot()).toBe("disconnected");

    // Advance past backoff delay — should NOT reconnect
    vi.advanceTimersByTime(10_000);
    expect(manager.getSnapshot()).toBe("disconnected");

    vi.useRealTimers();
  });

  it("exposes the last error via getLastError()", () => {
    const sseError = new Error("SSE failed");
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      try {
        opts.onerror?.(sseError);
      } catch {
        // Expected throw
      }
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getLastError()).toBe(sseError);
  });

  it("clears lastError on successful reconnect", () => {
    vi.useFakeTimers();
    const sseError = new Error("SSE failed");

    // First: connect successfully then lose connection
    let sseCallbacks: FetchEventSourceInit | undefined;
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      sseCallbacks = opts;
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connected");
    expect(manager.getLastError()).toBeNull();

    // Trigger error
    try {
      sseCallbacks?.onerror?.(sseError);
    } catch {
      // Expected throw
    }
    expect(manager.getLastError()).toBe(sseError);

    // Reconnect succeeds after backoff (past max possible jittered backoff: 1000 * 2^1 * 1.25)
    vi.advanceTimersByTime(3_000);
    expect(manager.getSnapshot()).toBe("connected");
    expect(manager.getLastError()).toBeNull();

    vi.useRealTimers();
  });

  it("connect returns true when connection is initiated", () => {
    const manager = makeManager();
    const result = manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(result).toBe(true);
  });

  it("connect returns false when already connecting", () => {
    mockFetchEventSource.mockImplementation(() => Promise.resolve());
    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    const result = manager.connect("tok2", brandId<SystemId>("sys_2"));
    expect(result).toBe(false);
  });

  it("ignores duplicate connect when already connecting", () => {
    mockFetchEventSource.mockImplementation(() => Promise.resolve());
    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getSnapshot()).toBe("connecting");
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);

    manager.connect("tok2", brandId<SystemId>("sys_2"));
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  });

  it("clears lastError on disconnect", () => {
    const sseError = new Error("SSE failed");
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      try {
        opts.onerror?.(sseError);
      } catch {
        // Expected throw
      }
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.connect("tok", brandId<SystemId>("sys_1"));
    expect(manager.getLastError()).toBe(sseError);

    manager.disconnect();
    expect(manager.getLastError()).toBeNull();
  });
});
