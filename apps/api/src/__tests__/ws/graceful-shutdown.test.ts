/**
 * Tests for M6: Graceful WebSocket shutdown.
 *
 * Verifies the phased shutdown sequence:
 * 1. Reject new connections
 * 2. Send close frames to existing connections
 * 3. Wait for in-flight handlers (with timeout)
 * 4. Force-close remaining connections
 */
import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../../ws/connection-manager.js";
import { WS_CLOSE_GOING_AWAY } from "../../ws/ws.constants.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

type AuthContextWithSystem = AuthContext & { readonly systemId: SystemId };

function mockAuth(accountId = brandId<AccountId>(crypto.randomUUID())): AuthContextWithSystem {
  const systemId = brandId<SystemId>(crypto.randomUUID());
  return {
    authMethod: "session" as const,
    accountId,
    systemId,
    sessionId: brandId<SessionId>(crypto.randomUUID()),
    accountType: "system",
    ownedSystemIds: new Set([systemId]),
    auditLogIpTracking: false,
  };
}

describe("graceful shutdown", () => {
  let manager: ConnectionManager;

  afterEach(() => {
    // Safety cleanup in case a test failed mid-shutdown
    if (manager.activeCount > 0) {
      manager.closeAll(WS_CLOSE_GOING_AWAY, "test cleanup");
    }
  });

  it("rejects new connections after shutdown starts", async () => {
    manager = new ConnectionManager();
    const ws1 = mockWs();
    manager.reserveUnauthSlot();
    manager.register("conn-1", ws1 as never, Date.now());

    const shutdownPromise = manager.gracefulShutdown(1_000);

    // After shutdown starts, isShuttingDown should be true
    expect(manager.isShuttingDown).toBe(true);
    // canAcceptUnauthenticated should reject even with a high limit
    expect(manager.canAcceptUnauthenticated(1000)).toBe(false);

    await shutdownPromise;
  });

  it("sends close frames to all existing connections", async () => {
    manager = new ConnectionManager();
    const ws1 = mockWs();
    const ws2 = mockWs();
    const auth = mockAuth();
    manager.reserveUnauthSlot();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
    manager.reserveUnauthSlot();
    manager.register("conn-2", ws2 as never, Date.now());

    await manager.gracefulShutdown(1_000);

    expect(ws1.close).toHaveBeenCalledWith(WS_CLOSE_GOING_AWAY, "Server shutting down");
    expect(ws2.close).toHaveBeenCalledWith(WS_CLOSE_GOING_AWAY, "Server shutting down");
  });

  it("clears all state after shutdown completes", async () => {
    manager = new ConnectionManager();
    const ws1 = mockWs();
    const auth = mockAuth();
    manager.reserveUnauthSlot();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.authenticate("conn-1", auth, auth.systemId, "owner-full");
    manager.addSubscription("conn-1", "doc-a");

    await manager.gracefulShutdown(1_000);

    expect(manager.activeCount).toBe(0);
    expect(manager.unauthenticatedCount).toBe(0);
    expect(manager.getSubscribers("doc-a").size).toBe(0);
    expect(manager.getByAccount(auth.accountId).size).toBe(0);
  });

  it("completes even when ws.close() throws", async () => {
    manager = new ConnectionManager();
    const ws = mockWs();
    ws.close.mockImplementation(() => {
      throw new Error("already closed");
    });
    manager.reserveUnauthSlot();
    manager.register("conn-1", ws as never, Date.now());

    await expect(manager.gracefulShutdown(1_000)).resolves.toBeUndefined();
    expect(manager.activeCount).toBe(0);
  });

  it("handles empty connection manager", async () => {
    manager = new ConnectionManager();
    await expect(manager.gracefulShutdown(1_000)).resolves.toBeUndefined();
    expect(manager.isShuttingDown).toBe(true);
  });

  it("force-closes connections when timeout expires", async () => {
    vi.useFakeTimers();
    manager = new ConnectionManager();
    const ws = mockWs();
    manager.reserveUnauthSlot();
    manager.register("conn-1", ws as never, Date.now());

    const shutdownPromise = manager.gracefulShutdown(500);

    // Advance time past the timeout
    await vi.advanceTimersByTimeAsync(600);
    await shutdownPromise;

    expect(manager.activeCount).toBe(0);
    vi.useRealTimers();
  });

  it("isShuttingDown is false by default", () => {
    manager = new ConnectionManager();
    expect(manager.isShuttingDown).toBe(false);
  });
});
