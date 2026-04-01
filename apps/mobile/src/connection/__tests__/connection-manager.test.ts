import { fetchEventSource } from "@microsoft/fetch-event-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";

import type { AuthStateSnapshot } from "../../auth/auth-types.js";
import type { FetchEventSourceInit } from "@microsoft/fetch-event-source";
import type {
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  PwhashSalt,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

const mockFetchEventSource = vi.mocked(fetchEventSource);

function makeManager(): ConnectionManager {
  return new ConnectionManager({ baseUrl: "https://example.com" });
}

const fakeCredentials = {
  sessionToken: "tok",
  accountId: "acct_1" as AccountId,
  systemId: "sys_1" as SystemId,
  salt: new Uint8Array(16) as PwhashSalt,
};

const unauthenticated: AuthStateSnapshot = {
  state: "unauthenticated",
  session: null,
  credentials: null,
};

const lockedSnapshot: AuthStateSnapshot = {
  state: "locked",
  session: null,
  credentials: fakeCredentials,
};

const unlockedSnapshot: AuthStateSnapshot = {
  state: "unlocked",
  session: {
    credentials: fakeCredentials,
    masterKey: new Uint8Array(32) as KdfMasterKey,
    identityKeys: {
      sign: {
        publicKey: new Uint8Array(32) as SignPublicKey,
        secretKey: new Uint8Array(64) as SignSecretKey,
      },
      box: {
        publicKey: new Uint8Array(32) as BoxPublicKey,
        secretKey: new Uint8Array(32) as BoxSecretKey,
      },
    },
  },
  credentials: fakeCredentials,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConnectionManager", () => {
  it("starts in disconnected state", () => {
    const manager = makeManager();
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("stays disconnected when unauthenticated auth state arrives", () => {
    const manager = makeManager();
    manager.onAuthStateChange(unauthenticated);
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("stays disconnected when locked auth state arrives", () => {
    const manager = makeManager();
    manager.onAuthStateChange(lockedSnapshot);
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("transitions to connecting (not connected) when unlocked auth state arrives", () => {
    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connecting");
  });

  it("transitions to connected only after SSE onopen fires", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connected");
  });

  it("disconnects when locked after being connected", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connected");
    manager.onAuthStateChange(lockedSnapshot);
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("disconnects when unauthenticated after being connected", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    manager.onAuthStateChange(unauthenticated);
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("notifies subscribers when state changes", () => {
    const manager = makeManager();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.onAuthStateChange(unlockedSnapshot);
    expect(listener).toHaveBeenCalled();
  });

  it("unsubscribe stops notifications", () => {
    const manager = makeManager();
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    unsub();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(listener).not.toHaveBeenCalled();
  });

  it("explicit disconnect moves to disconnected from any state", () => {
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
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
    manager.onAuthStateChange(unlockedSnapshot);
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
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connected");

    // Simulate connection lost — schedules backoff then reconnect
    expect(sseCallbacks).toBeDefined();
    try {
      sseCallbacks?.onerror?.(new Error("connection dropped"));
    } catch {
      // Expected throw — onerror throws to prevent fetchEventSource built-in retry
    }
    expect(manager.getSnapshot()).toBe("reconnecting");

    // Advance past backoff delay to trigger reconnect (baseBackoffMs * 2^retryCount = 1000 * 2^1)
    vi.advanceTimersByTime(2_000);
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
    manager.onAuthStateChange(unlockedSnapshot);
    // connecting -> CONNECTION_LOST -> backoff
    expect(manager.getSnapshot()).toBe("backoff");

    // After backoff, should reconnect
    mockFetchEventSource.mockImplementation((_url: RequestInfo, opts: FetchEventSourceInit) => {
      void opts.onopen?.(new Response());
      return Promise.resolve();
    });

    vi.advanceTimersByTime(2_000); // baseBackoffMs * 2^retryCount = 1000 * 2^1
    expect(manager.getSnapshot()).toBe("connected");

    vi.useRealTimers();
  });
});
