import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../../ws/connection-manager.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

function mockWs(): { close: ReturnType<typeof vi.fn> } {
  return { close: vi.fn() };
}

function mockAuth(accountId = "acct_test" as AccountId): AuthContext {
  return {
    accountId,
    systemId: "sys_test" as SystemId,
    sessionId: "sess_test" as SessionId,
    accountType: "system",
    ownedSystemIds: new Set(["sys_test" as SystemId]),
  };
}

describe("ConnectionManager", () => {
  let manager: ConnectionManager;

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  describe("register / remove", () => {
    it("registers a connection and increments activeCount", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      const state = manager.register("conn-1", ws as never, Date.now());

      expect(state.connectionId).toBe("conn-1");
      expect(state.phase).toBe("awaiting-auth");
      expect(state.auth).toBeNull();
      expect(manager.activeCount).toBe(1);
      expect(manager.unauthenticatedCount).toBe(1);
    });

    it("removes a connection and cleans all indexes", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      manager.register("conn-1", ws as never, Date.now());
      manager.authenticate("conn-1", mockAuth(), "sys_test", "owner-full");
      manager.addSubscription("conn-1", "doc-1");

      manager.remove("conn-1");

      expect(manager.activeCount).toBe(0);
      expect(manager.getSubscribers("doc-1").size).toBe(0);
      expect(manager.getByAccount("acct_test").size).toBe(0);
    });

    it("clears auth timeout on remove", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      const state = manager.register("conn-1", ws as never, Date.now());
      const handle = setTimeout(() => {}, 10_000);
      state.authTimeoutHandle = handle;

      manager.remove("conn-1");

      // Timer should have been cleared (no way to assert directly,
      // but we verify no throw and state is cleaned)
      expect(manager.activeCount).toBe(0);
    });

    it("decrements unauthenticatedCount on remove of unauthed connection", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.unauthenticatedCount).toBe(2);

      manager.remove("conn-1");
      expect(manager.unauthenticatedCount).toBe(1);
    });

    it("does not decrement unauthenticatedCount on remove of authed connection", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.authenticate("conn-1", mockAuth(), "sys_test", "owner-full");
      expect(manager.unauthenticatedCount).toBe(0);

      manager.remove("conn-1");
      expect(manager.unauthenticatedCount).toBe(0);
    });

    it("is safe to remove a non-existent connection", () => {
      manager = new ConnectionManager();
      expect(() => {
        manager.remove("does-not-exist");
      }).not.toThrow();
    });

    it("returns to zero after N connect/disconnect cycles", () => {
      manager = new ConnectionManager();
      const cycles = 100;
      for (let i = 0; i < cycles; i++) {
        manager.register(`conn-${String(i)}`, mockWs() as never, Date.now());
      }
      for (let i = 0; i < cycles; i++) {
        manager.remove(`conn-${String(i)}`);
      }
      expect(manager.activeCount).toBe(0);
      expect(manager.unauthenticatedCount).toBe(0);
    });
  });

  describe("authenticate", () => {
    it("promotes phase and updates account index", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.authenticate("conn-1", mockAuth(), "sys_test", "owner-full");

      const state = manager.get("conn-1");
      expect(state?.phase).toBe("authenticated");
      expect(state?.auth?.accountId).toBe("acct_test");
      expect(state?.systemId).toBe("sys_test");
      expect(state?.profileType).toBe("owner-full");
      expect(manager.unauthenticatedCount).toBe(0);
      expect(manager.getByAccount("acct_test").has("conn-1")).toBe(true);
    });

    it("is safe to authenticate a non-existent connection", () => {
      manager = new ConnectionManager();
      expect(() => {
        manager.authenticate("nope", mockAuth(), "sys_test", "owner-full");
      }).not.toThrow();
    });
  });

  describe("subscription indexes", () => {
    it("tracks subscriptions in docIndex", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.addSubscription("conn-1", "doc-a");
      manager.addSubscription("conn-1", "doc-b");

      expect(manager.getSubscribers("doc-a").has("conn-1")).toBe(true);
      expect(manager.getSubscribers("doc-b").has("conn-1")).toBe(true);
    });

    it("removeSubscription cleans up docIndex", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.addSubscription("conn-1", "doc-a");
      manager.removeSubscription("conn-1", "doc-a");

      expect(manager.getSubscribers("doc-a").size).toBe(0);
    });

    it("addSubscription is idempotent", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.addSubscription("conn-1", "doc-a");
      manager.addSubscription("conn-1", "doc-a");

      expect(manager.getSubscribers("doc-a").size).toBe(1);
    });

    it("removeSubscription on non-subscribed doc is a no-op", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      expect(() => {
        manager.removeSubscription("conn-1", "doc-x");
      }).not.toThrow();
    });

    it("getSubscribers returns empty set for unknown doc", () => {
      manager = new ConnectionManager();
      expect(manager.getSubscribers("unknown-doc").size).toBe(0);
    });

    it("returns only connections subscribed to a specific doc", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.register("conn-3", mockWs() as never, Date.now());

      manager.addSubscription("conn-1", "doc-a");
      manager.addSubscription("conn-2", "doc-a");
      manager.addSubscription("conn-3", "doc-b");

      const subs = manager.getSubscribers("doc-a");
      expect(subs.size).toBe(2);
      expect(subs.has("conn-1")).toBe(true);
      expect(subs.has("conn-2")).toBe(true);
      expect(subs.has("conn-3")).toBe(false);
    });
  });

  describe("multi-tab (same account)", () => {
    it("tracks multiple connections for the same account", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, "sys_test", "owner-full");
      manager.authenticate("conn-2", auth, "sys_test", "owner-lite");

      const acctConns = manager.getByAccount("acct_test");
      expect(acctConns.size).toBe(2);
      expect(acctConns.has("conn-1")).toBe(true);
      expect(acctConns.has("conn-2")).toBe(true);
    });

    it("removes only the disconnected connection from account index", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, "sys_test", "owner-full");
      manager.authenticate("conn-2", auth, "sys_test", "owner-full");

      manager.remove("conn-1");

      expect(manager.getByAccount("acct_test").size).toBe(1);
      expect(manager.getByAccount("acct_test").has("conn-2")).toBe(true);
    });

    it("getAccountConnectionCount reflects authenticated connections", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, "sys_test", "owner-full");

      expect(manager.getAccountConnectionCount("acct_test")).toBe(1);

      manager.authenticate("conn-2", auth, "sys_test", "owner-full");
      expect(manager.getAccountConnectionCount("acct_test")).toBe(2);
    });
  });

  describe("canAcceptUnauthenticated", () => {
    it("returns true when under limit", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(true);
    });

    it("returns false when at limit", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(false);
    });

    it("frees a slot when connection authenticates", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(false);

      manager.authenticate("conn-1", mockAuth(), "sys_test", "owner-full");
      expect(manager.canAcceptUnauthenticated(2)).toBe(true);
    });
  });

  describe("closeAll", () => {
    it("closes all connections and empties all indexes", () => {
      manager = new ConnectionManager();
      const ws1 = mockWs();
      const ws2 = mockWs();
      manager.register("conn-1", ws1 as never, Date.now());
      manager.register("conn-2", ws2 as never, Date.now());
      manager.authenticate("conn-1", mockAuth(), "sys_test", "owner-full");
      manager.addSubscription("conn-1", "doc-a");

      manager.closeAll(1001, "shutdown");

      expect(ws1.close).toHaveBeenCalledWith(1001, "shutdown");
      expect(ws2.close).toHaveBeenCalledWith(1001, "shutdown");
      expect(manager.activeCount).toBe(0);
      expect(manager.unauthenticatedCount).toBe(0);
      expect(manager.getSubscribers("doc-a").size).toBe(0);
      expect(manager.getByAccount("acct_test").size).toBe(0);
    });

    it("tolerates already-closed connections", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      ws.close.mockImplementation(() => {
        throw new Error("already closed");
      });
      manager.register("conn-1", ws as never, Date.now());

      expect(() => {
        manager.closeAll(1001, "shutdown");
      }).not.toThrow();
      expect(manager.activeCount).toBe(0);
    });
  });

  describe("get / getByAccount", () => {
    it("returns undefined for unknown connectionId", () => {
      manager = new ConnectionManager();
      expect(manager.get("nope")).toBeUndefined();
    });

    it("returns empty set for unknown accountId", () => {
      manager = new ConnectionManager();
      expect(manager.getByAccount("acct_unknown").size).toBe(0);
    });
  });
});
