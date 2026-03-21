import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { broadcastDocumentUpdate } from "../../ws/broadcast.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { asSyncDocId } from "../helpers/crypto-test-fixtures.js";

import type { AppLogger } from "../../lib/logger.js";
import type { DocumentUpdate } from "@pluralscape/sync";
import type { AccountId, SessionId, SyncDocumentId, SystemId } from "@pluralscape/types";

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function mockAuth(accountId = "acct_test" as AccountId) {
  return {
    accountId,
    systemId: "sys_test" as SystemId,
    sessionId: "sess_test" as SessionId,
    accountType: "system" as const,
    ownedSystemIds: new Set(["sys_test" as SystemId]),
  };
}

function makeUpdate(docId: SyncDocumentId = asSyncDocId("doc-1")): DocumentUpdate {
  return {
    type: "DocumentUpdate",
    correlationId: null,
    docId,
    changes: [],
  };
}

describe("broadcastDocumentUpdate", () => {
  let manager: ConnectionManager;
  const log = mockLog();

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("sends to all subscribers except the submitter", () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    const ws3 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.register("conn-3", ws3 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-2", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-3", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-1");
    manager.addSubscription("conn-3", "doc-1");

    broadcastDocumentUpdate(makeUpdate(), "conn-1", manager, log);

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledOnce();
    expect(ws3.send).toHaveBeenCalledOnce();
  });

  it("does nothing when no subscribers", () => {
    broadcastDocumentUpdate(makeUpdate(), "conn-1", manager, log);
    // No error, no send calls
  });

  it("skips connections that are not authenticated", () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    // conn-2 stays unauthenticated
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-1");

    broadcastDocumentUpdate(makeUpdate(), "conn-1", manager, log);

    // conn-1 excluded (submitter), conn-2 skipped (not authenticated)
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).not.toHaveBeenCalled();
  });

  it("tolerates send failures on individual connections", () => {
    const ws1 = mockWs();
    ws1.send.mockImplementation(() => {
      throw new Error("broken pipe");
    });
    const ws2 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-2", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-1");

    // conn-submitter is a separate connection
    manager.register("conn-sub", mockWs() as never, Date.now());
    manager.authenticate("conn-sub", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-sub", "doc-1");

    broadcastDocumentUpdate(makeUpdate(), "conn-sub", manager, log);

    // ws1 threw but ws2 should still receive
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it("closes and removes dead connection on send failure", () => {
    const ws1 = mockWs();
    ws1.send.mockImplementation(() => {
      throw new Error("broken pipe");
    });
    manager.reserveUnauthSlot();
    manager.register("conn-dead", ws1 as never, Date.now());
    manager.authenticate("conn-dead", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-dead", "doc-1");

    manager.reserveUnauthSlot();
    manager.register("conn-sub", mockWs() as never, Date.now());
    manager.authenticate("conn-sub", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-sub", "doc-1");

    broadcastDocumentUpdate(makeUpdate(), "conn-sub", manager, log);

    // Dead connection should have been closed and removed
    expect(ws1.close).toHaveBeenCalledWith(expect.any(Number), "Send failed");
    expect(manager.get("conn-dead")).toBeUndefined();
  });

  it("returns BroadcastResult with delivered/failed/total counts", () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-2", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-1");

    const result = broadcastDocumentUpdate(makeUpdate(), "nobody", manager, log);

    expect(result.delivered).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);
  });

  it("returns early on serialization failure", () => {
    const ws1 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");

    // Create an update with a circular reference to trigger serialization failure
    const badUpdate = makeUpdate();
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    Object.assign(badUpdate, { changes: [circular] });

    const result = broadcastDocumentUpdate(badUpdate, "nobody", manager, log);

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    expect(ws1.send).not.toHaveBeenCalled();
  });

  it("sends only to subscribers of the specific document", () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-2", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-2");

    broadcastDocumentUpdate(makeUpdate(asSyncDocId("doc-1")), "nobody", manager, log);

    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).not.toHaveBeenCalled();
  });
});
