/**
 * Branch coverage for apps/api/src/ws/connection-manager.ts.
 *
 * Covers branches not reached by existing tests:
 *   - releaseIpSlot: current > 1 path (decrements instead of deletes)
 *   - addSubscription: !state early-return (unknown connectionId)
 *   - removeSubscription: !state early-return (unknown connectionId)
 *   - removeSubscription: docSet.size > 0 after delete (other subscribers remain)
 *   - remove(): accountSet.size > 0 after delete (multi-connection account)
 *   - remove(): docSet.size > 0 after delete (multi-subscriber doc)
 *   - gracefulShutdown: force-close path (connections don't drain before timeout)
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Helpers ──────────────────────────────────────────────────────────

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

function makeAuth(accountId: string): AuthContext {
  return {
    authMethod: "session" as const,
    accountId: accountId as AccountId,
    systemId: "sys_cm_test" as SystemId,
    sessionId: "sess_cm_test" as SessionId,
    accountType: "system",
    ownedSystemIds: new Set(["sys_cm_test" as SystemId]),
    auditLogIpTracking: false,
  };
}

function registerAndAuthenticate(
  manager: ConnectionManager,
  connectionId: string,
  accountId = "acct_cm_test",
  ip?: string,
): void {
  manager.reserveUnauthSlot(ip);
  manager.register(connectionId, mockWs() as never, Date.now(), ip);
  manager.authenticate(connectionId, makeAuth(accountId), "sys_cm_test" as SystemId, "owner-full");
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("ConnectionManager branch coverage", () => {
  describe("releaseIpSlot: decrement path (current > 1)", () => {
    it("decrements per-IP count when multiple connections share the same IP", () => {
      const manager = new ConnectionManager();
      const ip = "10.0.0.1";

      // Reserve two slots for the same IP so count reaches 2
      manager.reserveUnauthSlot(ip);
      manager.reserveUnauthSlot(ip);

      // Release one — count goes from 2 → 1 (decrement, not delete)
      manager.releaseUnauthSlot(ip);

      // A third call is still accepted within the per-IP limit (ip entry still exists with count 1)
      expect(manager.canAcceptFromIp(ip, 10)).toBe(true);

      // Release the second — count goes from 1 → delete
      manager.releaseUnauthSlot(ip);
      // Entry deleted; canAcceptFromIp treats missing entry as 0, so 0 < 1 is true
      expect(manager.canAcceptFromIp(ip, 1)).toBe(true);
    });
  });

  describe("addSubscription: connection not found", () => {
    it("returns false when connectionId does not exist", () => {
      const manager = new ConnectionManager();
      const result = manager.addSubscription("nonexistent-conn", "doc-123");
      expect(result).toBe(false);
    });
  });

  describe("removeSubscription: connection not found", () => {
    it("returns without error when connectionId does not exist", () => {
      const manager = new ConnectionManager();
      // Should not throw
      expect(() => {
        manager.removeSubscription("nonexistent-conn", "doc-123");
      }).not.toThrow();
    });
  });

  describe("removeSubscription: doc retains other subscribers after delete", () => {
    it("does not delete the docIndex entry when other connections remain subscribed", () => {
      const manager = new ConnectionManager();
      registerAndAuthenticate(manager, "conn-sub-a");
      registerAndAuthenticate(manager, "conn-sub-b", "acct_cm_b");

      manager.addSubscription("conn-sub-a", "doc-shared");
      manager.addSubscription("conn-sub-b", "doc-shared");

      // Remove one — docSet still has conn-sub-b, so entry must NOT be deleted
      manager.removeSubscription("conn-sub-a", "doc-shared");

      const subscribers = manager.getSubscribers("doc-shared");
      expect(subscribers.size).toBe(1);
      expect(subscribers.has("conn-sub-b")).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("remove: accountSet retains other connections after delete", () => {
    it("does not delete the accountIndex entry when other connections for the account remain", () => {
      const manager = new ConnectionManager();
      // Two connections authenticated to the same account
      registerAndAuthenticate(manager, "conn-acct-1", "acct_shared");
      registerAndAuthenticate(manager, "conn-acct-2", "acct_shared");

      // Remove one — accountSet still has conn-acct-2
      manager.remove("conn-acct-1");

      expect(manager.getAccountConnectionCount("acct_shared")).toBe(1);
      expect(manager.getByAccount("acct_shared").has("conn-acct-2")).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("remove: docSet retains other connections after delete", () => {
    it("does not delete the docIndex entry when other connections remain subscribed to the doc", () => {
      const manager = new ConnectionManager();
      registerAndAuthenticate(manager, "conn-doc-a");
      registerAndAuthenticate(manager, "conn-doc-b", "acct_cm_b");

      manager.addSubscription("conn-doc-a", "doc-multi");
      manager.addSubscription("conn-doc-b", "doc-multi");

      // Remove conn-doc-a entirely — docIndex for doc-multi still has conn-doc-b
      manager.remove("conn-doc-a");

      const subscribers = manager.getSubscribers("doc-multi");
      expect(subscribers.size).toBe(1);
      expect(subscribers.has("conn-doc-b")).toBe(true);

      manager.closeAll(1001, "test cleanup");
    });
  });

  describe("gracefulShutdown: force-close path when connections don't drain", () => {
    it("force-closes remaining connections after timeout expires", async () => {
      vi.useFakeTimers();

      const manager = new ConnectionManager();
      const ws = mockWs();
      manager.reserveUnauthSlot();
      manager.register("conn-shutdown", ws as never, Date.now());
      // Do NOT remove the connection during drain — simulate a connection that never closes

      // Start shutdown with a short timeout; connections.size stays > 0 throughout
      const shutdownPromise = manager.gracefulShutdown(100);

      // Advance time past the timeout so the while loop exits and force-close fires
      await vi.runAllTimersAsync();
      await shutdownPromise;

      // ws.close should have been called at least twice: initial close + force-close
      expect(ws.close.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(manager.activeCount).toBe(0);

      vi.useRealTimers();
    });
  });
});
