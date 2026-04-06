/**
 * Tests for M5: Bounded subscribe concurrency.
 *
 * Verifies that handleSubscribeRequest processes documents in bounded
 * batches of WS_SUBSCRIBE_CONCURRENCY rather than unbounded Promise.all.
 */
import { EncryptedRelay } from "@pluralscape/sync";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import { handleSubscribeRequest } from "../../ws/handlers.js";
import { WS_SUBSCRIBE_CONCURRENCY } from "../../ws/ws.constants.js";
import { asSyncDocId, nonce, pubkey, sig } from "../helpers/crypto-test-fixtures.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type {
  EncryptedChangeEnvelope,
  SubscribeRequest,
  SyncRelayService,
} from "@pluralscape/sync";
import type { AccountId, SessionId, SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Test helpers ──────────────────────────────────────────────────────

let changeCounter = 0;

function mockChangeWithoutSeq(id: SyncDocumentId): Omit<EncryptedChangeEnvelope, "seq"> {
  const fill = ++changeCounter;
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(fill),
    signature: sig(fill),
    authorPublicKey: pubkey(10),
    documentId: id,
  };
}

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

function mockAuth(accountId = crypto.randomUUID() as AccountId): AuthContext {
  return {
    authMethod: "session" as const,
    accountId,
    systemId: crypto.randomUUID() as SystemId,
    sessionId: crypto.randomUUID() as SessionId,
    accountType: "system",
    ownedSystemIds: new Set(),
    auditLogIpTracking: false,
  };
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

// ── Tests ─────────────────────────────────────────────────────────────

describe("bounded subscribe concurrency", () => {
  let manager: ConnectionManager | undefined;

  afterEach(() => {
    manager?.closeAll(1001, "test cleanup");
    manager = undefined;
  });

  it("exports the expected subscribe concurrency constant", () => {
    expect(WS_SUBSCRIBE_CONCURRENCY).toBe(10);
  });

  it("processes all documents correctly with more docs than concurrency limit", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const log = mockLog();

    // Register and authenticate connection
    manager.reserveUnauthSlot();
    manager.register(connId, mockWs() as never, Date.now());
    manager.authenticate(connId, auth, systemId as SystemId, "owner-full");
    const state = manager.get(connId);
    if (!state) throw new Error("Connection not found");

    // Create more documents than the concurrency limit
    const docCount = WS_SUBSCRIBE_CONCURRENCY + 5;
    const docIds: SyncDocumentId[] = [];
    for (let i = 0; i < docCount; i++) {
      const docId = asSyncDocId(crypto.randomUUID());
      docIds.push(docId);
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: docIds.map((docId) => ({ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 })),
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.type).toBe("SubscribeResponse");
    // All docs should have catchup data since they each have one change
    expect(result.catchup).toHaveLength(docCount);
    expect(result.droppedDocIds).toEqual([]);
  });

  it("processes exactly the concurrency limit of documents", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const log = mockLog();

    manager.reserveUnauthSlot();
    manager.register(connId, mockWs() as never, Date.now());
    manager.authenticate(connId, auth, systemId as SystemId, "owner-full");
    const state = manager.get(connId);
    if (!state) throw new Error("Connection not found");

    const docIds: SyncDocumentId[] = [];
    for (let i = 0; i < WS_SUBSCRIBE_CONCURRENCY; i++) {
      const docId = asSyncDocId(crypto.randomUUID());
      docIds.push(docId);
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: docIds.map((docId) => ({ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 })),
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.catchup).toHaveLength(WS_SUBSCRIBE_CONCURRENCY);
  });

  it("handles fewer documents than concurrency limit", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const log = mockLog();

    manager.reserveUnauthSlot();
    manager.register(connId, mockWs() as never, Date.now());
    manager.authenticate(connId, auth, systemId as SystemId, "owner-full");
    const state = manager.get(connId);
    if (!state) throw new Error("Connection not found");

    const docCount = 3;
    const docIds: SyncDocumentId[] = [];
    for (let i = 0; i < docCount; i++) {
      const docId = asSyncDocId(crypto.randomUUID());
      docIds.push(docId);
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: docIds.map((docId) => ({ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 })),
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.catchup).toHaveLength(docCount);
  });

  it("limits concurrent relay calls to WS_SUBSCRIBE_CONCURRENCY", async () => {
    manager = new ConnectionManager();
    const connId = crypto.randomUUID();
    const auth = mockAuth();
    const log = mockLog();

    manager.reserveUnauthSlot();
    manager.register(connId, mockWs() as never, Date.now());
    manager.authenticate(connId, auth, auth.systemId as SystemId, "owner-full");
    const state = manager.get(connId);
    if (!state) throw new Error("Connection not found");

    // Create enough docs to span multiple batches
    const docCount = WS_SUBSCRIBE_CONCURRENCY * 3;
    const docIds = Array.from({ length: docCount }, () => asSyncDocId(crypto.randomUUID()));

    // Track concurrency via getEnvelopesSince calls
    let inFlight = 0;
    let maxInFlight = 0;

    const mockRelay: SyncRelayService = {
      async getEnvelopesSince() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        // Intentional real delay to simulate async I/O and measure concurrency
        await new Promise<void>((r) => setTimeout(r, 1));
        inFlight--;
        return { envelopes: [], hasMore: false };
      },
      getLatestSnapshot: () => Promise.resolve(null),
      submit: () => Promise.resolve(1),
      submitSnapshot: () => Promise.resolve(),
      getManifest: (systemId) => Promise.resolve({ systemId, documents: [] }),
    };

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: docIds.map((docId) => ({ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 })),
    };

    await handleSubscribeRequest(message, state, manager, mockRelay, log);

    expect(maxInFlight).toBeLessThanOrEqual(WS_SUBSCRIBE_CONCURRENCY);
    expect(maxInFlight).toBeGreaterThan(0);
  });
});
