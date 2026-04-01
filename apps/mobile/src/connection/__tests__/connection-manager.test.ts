import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";

import type { AuthStateSnapshot } from "../../auth/auth-types.js";
import type { PwhashSalt } from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

function makeManager(): ConnectionManager {
  return new ConnectionManager({ baseUrl: "https://example.com" });
}

const unauthenticated: AuthStateSnapshot = {
  state: "unauthenticated",
  session: null,
  credentials: null,
};

const lockedSnapshot: AuthStateSnapshot = {
  state: "locked",
  session: null,
  credentials: {
    sessionToken: "tok",
    accountId: "acct_1" as AccountId,
    systemId: "sys_1" as SystemId,
    salt: new Uint8Array(16) as PwhashSalt,
  },
};

const unlockedSnapshot: AuthStateSnapshot = {
  state: "unlocked",
  session: null,
  credentials: {
    sessionToken: "tok",
    accountId: "acct_1" as AccountId,
    systemId: "sys_1" as SystemId,
    salt: new Uint8Array(16) as PwhashSalt,
  },
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

  it("transitions to connected when unlocked auth state arrives", () => {
    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connected");
  });

  it("disconnects when locked after being connected", () => {
    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connected");
    manager.onAuthStateChange(lockedSnapshot);
    expect(manager.getSnapshot()).toBe("disconnected");
  });

  it("disconnects when unauthenticated after being connected", () => {
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
    const manager = makeManager();
    manager.onAuthStateChange(unlockedSnapshot);
    manager.disconnect();
    expect(manager.getSnapshot()).toBe("disconnected");
  });
});
