import { initSodium } from "@pluralscape/crypto";
import { EncryptedRelay } from "@pluralscape/sync";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Envelope signature verification is unconditional. Mock data has invalid
// signatures, so we stub verifyEnvelopeSignature at module-mock time.
vi.mock("@pluralscape/sync", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
  return {
    ...actual,
    verifyEnvelopeSignature: vi.fn(() => true),
  };
});

import { ConnectionManager } from "../../ws/connection-manager.js";
import { handleSubscribeRequest, handleUnsubscribeRequest } from "../../ws/handlers.js";
import { asSyncDocId } from "../helpers/crypto-test-fixtures.js";
import {
  createAuthenticatedState,
  mockAuth,
  mockChangeWithoutSeq,
  mockLog,
  mockSnapshot,
} from "../helpers/ws-handlers-fixtures.js";

import type { SubscribeRequest, UnsubscribeRequest } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

const log = mockLog();

beforeAll(async () => {
  await initSodium();
});

describe("handleSubscribeRequest", () => {
  let manager: ConnectionManager;

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("registers subscriptions and returns catchup with changes", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    // Submit a change so catchup has data
    await relay.submit(mockChangeWithoutSeq(docId));

    const correlationId = crypto.randomUUID();
    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId,
      documents: [{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.type).toBe("SubscribeResponse");
    expect(result.correlationId).toBe(correlationId);
    expect(result.catchup).toHaveLength(1);
    expect(result.catchup[0]?.docId).toBe(docId);
    expect(result.catchup[0]?.changes).toHaveLength(1);
    expect(result.catchup[0]?.snapshot).toBeNull();
  });

  it("includes newer snapshot in catchup when available", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    await relay.submitSnapshot(mockSnapshot(docId, 1));
    await relay.submit(mockChangeWithoutSeq(docId));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.catchup).toHaveLength(1);
    expect(result.catchup[0]?.snapshot).not.toBeNull();
    expect(result.catchup[0]?.snapshot?.snapshotVersion).toBe(1);
  });

  it("omits catchup entry when client is already current", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    // Submit and then subscribe with the current seq
    const seq = await relay.submit(mockChangeWithoutSeq(docId));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId, lastSyncedSeq: seq, lastSnapshotVersion: 0 }],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.catchup).toHaveLength(0);
  });

  it("adds subscription to connection manager", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };

    await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(manager.getSubscribers(docId).has(connId)).toBe(true);
  });

  it("skips catchup for documents beyond subscription cap", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    // Fill subscription cap (WS_MAX_SUBSCRIPTIONS_PER_CONNECTION defaults to 500)
    for (let i = 0; i < 500; i++) {
      manager.addSubscription(connId, `doc-fill-${String(i)}`);
    }

    // Now subscribe to one more doc that has data
    const extraDocId = asSyncDocId(crypto.randomUUID());
    await relay.submit(mockChangeWithoutSeq(extraDocId));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId: extraDocId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    // The excess doc should NOT be in catchup since subscription cap was reached
    expect(result.catchup).toHaveLength(0);
    expect(result.droppedDocIds).toEqual([extraDocId]);
  });

  it("returns empty droppedDocIds when all subscriptions succeed", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    await relay.submit(mockChangeWithoutSeq(docId));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay.asService(), log);

    expect(result.droppedDocIds).toEqual([]);
  });
});

describe("handleUnsubscribeRequest", () => {
  let manager: ConnectionManager;

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("removes subscription from connection manager", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    // Subscribe first
    const subMsg: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId, lastSyncedSeq: 0, lastSnapshotVersion: 0 }],
    };
    await handleSubscribeRequest(subMsg, state, manager, relay.asService(), log);
    expect(manager.getSubscribers(docId).has(connId)).toBe(true);

    // Now unsubscribe
    const unsubMsg: UnsubscribeRequest = {
      type: "UnsubscribeRequest",
      correlationId: crypto.randomUUID(),
      docId,
    };
    handleUnsubscribeRequest(unsubMsg, state, manager);

    expect(manager.getSubscribers(docId).has(connId)).toBe(false);
  });

  it("is idempotent when unsubscribing from a non-subscribed document", () => {
    manager = new ConnectionManager();
    const docId = asSyncDocId(crypto.randomUUID());
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, brandId<SystemId>(systemId));

    const message: UnsubscribeRequest = {
      type: "UnsubscribeRequest",
      correlationId: crypto.randomUUID(),
      docId,
    };

    expect(() => {
      handleUnsubscribeRequest(message, state, manager);
    }).not.toThrow();
  });
});
