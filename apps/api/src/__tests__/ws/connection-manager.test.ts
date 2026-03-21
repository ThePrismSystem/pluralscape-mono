import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../../ws/connection-manager.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

function mockWs(): { close: ReturnType<typeof vi.fn> } {
  return { close: vi.fn() };
}

type AuthContextWithSystem = AuthContext & { readonly systemId: SystemId };

function mockAuth(accountId = crypto.randomUUID() as AccountId): AuthContextWithSystem {
  const systemId = crypto.randomUUID() as SystemId;
  return {
    accountId,
    systemId,
    sessionId: crypto.randomUUID() as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([systemId]),
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
      manager.reserveUnauthSlot();
      const state = manager.register("conn-1", ws as never, Date.now());

      expect(state.connectionId).toBe("conn-1");
      expect(state.phase).toBe("awaiting-auth");
      expect(state.auth).toBeNull();
      expect(state.rateLimitStrikes).toBe(0);
      expect(manager.activeCount).toBe(1);
      expect(manager.unauthenticatedCount).toBe(1);
    });

    it("removes a connection and cleans all indexes", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", ws as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      manager.addSubscription("conn-1", "doc-1");

      manager.remove("conn-1");

      expect(manager.activeCount).toBe(0);
      expect(manager.getSubscribers("doc-1").size).toBe(0);
      expect(manager.getByAccount(auth.accountId).size).toBe(0);
    });

    it("clears auth timeout on remove", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      manager.reserveUnauthSlot();
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
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.unauthenticatedCount).toBe(2);

      manager.remove("conn-1");
      expect(manager.unauthenticatedCount).toBe(1);
    });

    it("does not decrement unauthenticatedCount on remove of authed connection", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
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
        manager.reserveUnauthSlot();
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
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      const result = manager.authenticate("conn-1", auth, auth.systemId, "owner-full");

      expect(result).toBe(true);
      const state = manager.get("conn-1");
      expect(state?.phase).toBe("authenticated");
      expect(state?.auth?.accountId).toBe(auth.accountId);
      expect(state?.systemId).toBe(auth.systemId);
      expect(state?.profileType).toBe("owner-full");
      expect(manager.unauthenticatedCount).toBe(0);
      expect(manager.getByAccount(auth.accountId).has("conn-1")).toBe(true);
    });

    it("returns false for non-existent connection", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      const result = manager.authenticate("nope", auth, auth.systemId, "owner-full");
      expect(result).toBe(false);
    });

    it("clears auth timeout on authenticate", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      const state = manager.register("conn-1", mockWs() as never, Date.now());
      state.authTimeoutHandle = setTimeout(() => {}, 10_000);

      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");

      const updated = manager.get("conn-1");
      expect(updated?.authTimeoutHandle).toBeNull();
    });
  });

  describe("reserveUnauthSlot / releaseUnauthSlot", () => {
    it("increments and decrements unauthenticatedCount", () => {
      manager = new ConnectionManager();
      expect(manager.unauthenticatedCount).toBe(0);

      manager.reserveUnauthSlot();
      expect(manager.unauthenticatedCount).toBe(1);

      manager.releaseUnauthSlot();
      expect(manager.unauthenticatedCount).toBe(0);
    });

    it("releaseUnauthSlot never goes negative", () => {
      manager = new ConnectionManager();
      expect(manager.unauthenticatedCount).toBe(0);

      manager.releaseUnauthSlot();
      expect(manager.unauthenticatedCount).toBe(0);

      manager.releaseUnauthSlot();
      expect(manager.unauthenticatedCount).toBe(0);
    });

    it("register does not increment unauthenticatedCount", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      expect(manager.unauthenticatedCount).toBe(0);
    });
  });

  describe("authenticate phase guard", () => {
    it("only decrements unauthCount when transitioning from awaiting-auth", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      expect(manager.unauthenticatedCount).toBe(0);

      // Second authenticate call on already-authenticated connection should not go negative
      const auth2 = mockAuth();
      const result = manager.authenticate("conn-1", auth2, auth2.systemId, "owner-full");
      expect(result).toBe(false);
      expect(manager.unauthenticatedCount).toBe(0);
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

    it("addSubscription returns false at subscription cap", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());

      // Fill to cap (500)
      for (let i = 0; i < 500; i++) {
        expect(manager.addSubscription("conn-1", `doc-${String(i)}`)).toBe(true);
      }

      // 501st should be rejected
      expect(manager.addSubscription("conn-1", "doc-over-limit")).toBe(false);
      expect(manager.getSubscribers("doc-over-limit").size).toBe(0);
    });

    it("addSubscription allows re-subscribing to existing doc at cap", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());

      for (let i = 0; i < 500; i++) {
        manager.addSubscription("conn-1", `doc-${String(i)}`);
      }

      // Re-subscribing to existing doc should succeed (idempotent)
      expect(manager.addSubscription("conn-1", "doc-0")).toBe(true);
    });

    it("removeSubscriptionsForDoc clears all connections for a doc", () => {
      manager = new ConnectionManager();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.addSubscription("conn-1", "doc-evicted");
      manager.addSubscription("conn-2", "doc-evicted");
      manager.addSubscription("conn-1", "doc-kept");

      manager.removeSubscriptionsForDoc("doc-evicted");

      expect(manager.getSubscribers("doc-evicted").size).toBe(0);
      // Other subscriptions unaffected
      expect(manager.getSubscribers("doc-kept").has("conn-1")).toBe(true);
      // Connection's subscribedDocs should no longer contain evicted doc
      const state = manager.get("conn-1");
      expect(state?.subscribedDocs.has("doc-evicted")).toBe(false);
      expect(state?.subscribedDocs.has("doc-kept")).toBe(true);
    });

    it("removeSubscriptionsForDoc is safe for unknown doc", () => {
      manager = new ConnectionManager();
      expect(() => {
        manager.removeSubscriptionsForDoc("does-not-exist");
      }).not.toThrow();
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
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      manager.authenticate("conn-2", auth, auth.systemId, "owner-lite");

      const acctConns = manager.getByAccount(auth.accountId);
      expect(acctConns.size).toBe(2);
      expect(acctConns.has("conn-1")).toBe(true);
      expect(acctConns.has("conn-2")).toBe(true);
    });

    it("removes only the disconnected connection from account index", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      manager.authenticate("conn-2", auth, auth.systemId, "owner-full");

      manager.remove("conn-1");

      expect(manager.getByAccount(auth.accountId).size).toBe(1);
      expect(manager.getByAccount(auth.accountId).has("conn-2")).toBe(true);
    });

    it("getAccountConnectionCount reflects authenticated connections", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");

      expect(manager.getAccountConnectionCount(auth.accountId)).toBe(1);

      manager.authenticate("conn-2", auth, auth.systemId, "owner-full");
      expect(manager.getAccountConnectionCount(auth.accountId)).toBe(2);
    });
  });

  describe("canAcceptUnauthenticated", () => {
    it("returns true when under limit", () => {
      manager = new ConnectionManager();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(true);
    });

    it("returns false when at limit", () => {
      manager = new ConnectionManager();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(false);
    });

    it("frees a slot when connection authenticates", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      manager.reserveUnauthSlot();
      manager.register("conn-1", mockWs() as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", mockWs() as never, Date.now());
      expect(manager.canAcceptUnauthenticated(2)).toBe(false);

      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      expect(manager.canAcceptUnauthenticated(2)).toBe(true);
    });
  });

  describe("closeAll", () => {
    it("closes all connections and empties all indexes", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      const ws1 = mockWs();
      const ws2 = mockWs();
      manager.reserveUnauthSlot();
      manager.register("conn-1", ws1 as never, Date.now());
      manager.reserveUnauthSlot();
      manager.register("conn-2", ws2 as never, Date.now());
      manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
      manager.addSubscription("conn-1", "doc-a");

      manager.closeAll(1001, "shutdown");

      expect(ws1.close).toHaveBeenCalledWith(1001, "shutdown");
      expect(ws2.close).toHaveBeenCalledWith(1001, "shutdown");
      expect(manager.activeCount).toBe(0);
      expect(manager.unauthenticatedCount).toBe(0);
      expect(manager.getSubscribers("doc-a").size).toBe(0);
      expect(manager.getByAccount(auth.accountId).size).toBe(0);
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

    it("logs debug message when close fails and logger provided", () => {
      manager = new ConnectionManager();
      const ws = mockWs();
      ws.close.mockImplementation(() => {
        throw new Error("already closed");
      });
      manager.register("conn-1", ws as never, Date.now());
      const debugFn = vi.fn();

      manager.closeAll(1001, "shutdown", { debug: debugFn });

      expect(debugFn).toHaveBeenCalledWith(
        "Failed to close WebSocket",
        expect.objectContaining({ connectionId: "conn-1" }),
      );
    });
  });

  describe("per-account connection limit enforcement", () => {
    it("getAccountConnectionCount reflects the limit boundary", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      const maxPerAccount = 10;

      // Register and authenticate connections up to the limit
      for (let i = 0; i < maxPerAccount; i++) {
        manager.reserveUnauthSlot();
        manager.register(`conn-limit-${String(i)}`, mockWs() as never, Date.now());
        manager.authenticate(`conn-limit-${String(i)}`, auth, auth.systemId, "owner-full");
      }

      expect(manager.getAccountConnectionCount(auth.accountId)).toBe(maxPerAccount);
    });

    it("decrements account count when connections are removed", () => {
      manager = new ConnectionManager();
      const auth = mockAuth();
      const connectionCount = 5;

      for (let i = 0; i < connectionCount; i++) {
        manager.reserveUnauthSlot();
        manager.register(`conn-dec-${String(i)}`, mockWs() as never, Date.now());
        manager.authenticate(`conn-dec-${String(i)}`, auth, auth.systemId, "owner-full");
      }

      expect(manager.getAccountConnectionCount(auth.accountId)).toBe(connectionCount);

      manager.remove("conn-dec-0");
      expect(manager.getAccountConnectionCount(auth.accountId)).toBe(connectionCount - 1);
    });

    it("isolates connection counts between different accounts", () => {
      manager = new ConnectionManager();
      const authA = mockAuth();
      const authB = mockAuth();

      // Account A: 3 connections
      for (let i = 0; i < 3; i++) {
        manager.reserveUnauthSlot();
        manager.register(`conn-a-${String(i)}`, mockWs() as never, Date.now());
        manager.authenticate(`conn-a-${String(i)}`, authA, authA.systemId, "owner-full");
      }

      // Account B: 2 connections
      for (let i = 0; i < 2; i++) {
        manager.reserveUnauthSlot();
        manager.register(`conn-b-${String(i)}`, mockWs() as never, Date.now());
        manager.authenticate(`conn-b-${String(i)}`, authB, authB.systemId, "owner-full");
      }

      expect(manager.getAccountConnectionCount(authA.accountId)).toBe(3);
      expect(manager.getAccountConnectionCount(authB.accountId)).toBe(2);

      // Removing from account A does not affect account B
      manager.remove("conn-a-0");
      expect(manager.getAccountConnectionCount(authA.accountId)).toBe(2);
      expect(manager.getAccountConnectionCount(authB.accountId)).toBe(2);
    });
  });

  describe("get / getByAccount", () => {
    it("returns undefined for unknown connectionId", () => {
      manager = new ConnectionManager();
      expect(manager.get("nope")).toBeUndefined();
    });

    it("returns empty set for unknown accountId", () => {
      manager = new ConnectionManager();
      expect(manager.getByAccount(crypto.randomUUID()).size).toBe(0);
    });
  });
});
