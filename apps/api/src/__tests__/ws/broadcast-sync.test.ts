import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { broadcastDocumentUpdateWithSync } from "../../ws/broadcast.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { VALKEY_CHANNEL_PREFIX_SYNC } from "../../ws/ws.constants.js";
import { asSyncDocId } from "../helpers/crypto-test-fixtures.js";

import type { AppLogger } from "../../lib/logger.js";
import type { DocumentUpdate } from "@pluralscape/sync";
import type { AccountId, SessionId, SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Helpers ────────────────────────────────────────────────────────

/** Minimal pub/sub shape matching what broadcastDocumentUpdateWithSync needs. */
interface MockPubSub {
  readonly id: string;
  publish(channel: string, message: string): Promise<boolean>;
  readonly connected: boolean;
}

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
    auditLogIpTracking: false,
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

function mockPubSub(serverId = "server-1"): {
  pubsub: MockPubSub;
  publishMock: ReturnType<typeof vi.fn>;
} {
  const publishMock = vi.fn().mockResolvedValue(true);
  const pubsub: MockPubSub = {
    id: serverId,
    publish: publishMock,
    connected: true,
  };
  return { pubsub, publishMock };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("broadcastDocumentUpdateWithSync", () => {
  let manager: ConnectionManager;
  const log = mockLog();

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("performs local delivery and publishes to Valkey", async () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.register("conn-2", ws2 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.authenticate("conn-2", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");
    manager.addSubscription("conn-2", "doc-1");

    const { pubsub, publishMock } = mockPubSub("server-A");
    const update = makeUpdate();

    const result = await broadcastDocumentUpdateWithSync(update, "conn-1", manager, log, pubsub);

    // Local delivery: conn-2 should receive (conn-1 excluded)
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(1);

    // Valkey publish
    const expectedChannel = `${VALKEY_CHANNEL_PREFIX_SYNC}doc-1`;
    expect(publishMock).toHaveBeenCalledOnce();
    expect(publishMock).toHaveBeenCalledWith(expectedChannel, expect.any(String));

    // Verify published message contains serverId for dedup
    const rawPayload = publishMock.mock.calls[0]?.[1] as string;
    const publishedPayload = JSON.parse(rawPayload) as Record<string, unknown>;
    expect(publishedPayload).toHaveProperty("serverId", "server-A");
    expect(publishedPayload).toHaveProperty("update");
  });

  it("falls back to local-only when pubsub is null", async () => {
    const ws1 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");

    const result = await broadcastDocumentUpdateWithSync(
      makeUpdate(),
      "nobody",
      manager,
      log,
      null,
    );

    expect(ws1.send).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(1);
  });

  it("continues local delivery when Valkey publish fails", async () => {
    const ws1 = mockWs();
    manager.register("conn-1", ws1 as never, Date.now());
    manager.authenticate("conn-1", mockAuth(), "sys_test" as SystemId, "owner-full");
    manager.addSubscription("conn-1", "doc-1");

    const { pubsub, publishMock } = mockPubSub();
    publishMock.mockResolvedValueOnce(false);

    const result = await broadcastDocumentUpdateWithSync(
      makeUpdate(),
      "nobody",
      manager,
      log,
      pubsub,
    );

    // Local delivery still works
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(result.delivered).toBe(1);
  });

  it("uses correct Valkey channel prefix", async () => {
    const { pubsub, publishMock } = mockPubSub();

    await broadcastDocumentUpdateWithSync(
      makeUpdate(asSyncDocId("my-doc-xyz")),
      "nobody",
      manager,
      log,
      pubsub,
    );

    expect(publishMock).toHaveBeenCalledWith(
      `${VALKEY_CHANNEL_PREFIX_SYNC}my-doc-xyz`,
      expect.any(String),
    );
  });

  it("includes serialized DocumentUpdate in Valkey message", async () => {
    const { pubsub, publishMock } = mockPubSub("srv-99");
    const update = makeUpdate(asSyncDocId("doc-payload"));

    await broadcastDocumentUpdateWithSync(update, "nobody", manager, log, pubsub);

    const payload = JSON.parse(publishMock.mock.calls[0]?.[1] as string) as {
      serverId: string;
      update: DocumentUpdate;
    };
    expect(payload.serverId).toBe("srv-99");
    expect(payload.update.type).toBe("DocumentUpdate");
    expect(payload.update.docId).toBe("doc-payload");
  });
});
