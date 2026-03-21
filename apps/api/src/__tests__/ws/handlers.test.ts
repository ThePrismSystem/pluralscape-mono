import { getSodium, initSodium } from "@pluralscape/crypto";
import { EncryptedRelay } from "@pluralscape/sync";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../../ws/connection-manager.js";
import {
  handleManifestRequest,
  handleSubscribeRequest,
  handleUnsubscribeRequest,
  handleFetchSnapshot,
  handleFetchChanges,
  handleSubmitChange,
  handleSubmitSnapshot,
  handleDocumentLoad,
} from "../../ws/handlers.js";
import { nonce, pubkey, sig } from "../helpers/crypto-test-fixtures.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AppLogger } from "../../lib/logger.js";
import type { SyncConnectionState } from "../../ws/connection-state.js";
import type { SubmitChangeResult } from "../../ws/handlers.js";
import type {
  DocumentLoadRequest,
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  FetchChangesRequest,
  FetchSnapshotRequest,
  ManifestRequest,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SubscribeRequest,
  SyncError,
  SyncRelayService,
  UnsubscribeRequest,
} from "@pluralscape/sync";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Test helpers ──────────────────────────────────────────────────────

let changeCounter = 0;

function mockChangeWithoutSeq(docId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  const fill = ++changeCounter;
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(fill),
    signature: sig(fill),
    authorPublicKey: pubkey(10),
    documentId: docId,
  };
}

function mockSnapshot(docId: string, version: number): EncryptedSnapshotEnvelope {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(4),
    signature: sig(7),
    authorPublicKey: pubkey(10),
    documentId: docId,
    snapshotVersion: version,
  };
}

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

function mockAuth(accountId = crypto.randomUUID() as AccountId): AuthContext {
  return {
    accountId,
    systemId: crypto.randomUUID() as SystemId,
    sessionId: crypto.randomUUID() as SessionId,
    accountType: "system",
    ownedSystemIds: new Set(),
  };
}

function createAuthenticatedState(
  manager: ConnectionManager,
  connId: string,
  auth: AuthContext,
  systemId: SystemId,
): SyncConnectionState {
  manager.reserveUnauthSlot();
  manager.register(connId, mockWs() as never, Date.now());
  manager.authenticate(connId, auth, systemId, "owner-full");
  const state = manager.get(connId);
  if (!state) {
    throw new Error(`Connection ${connId} not found after registration`);
  }
  return state;
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

/** Type guard: returns true if the result is a SubmitChangeResult (not SyncError). */
function isSubmitChangeResult(
  result: SubmitChangeResult | SyncError,
): result is SubmitChangeResult {
  return result.type === "SubmitChangeResult";
}

const log = mockLog();

// Disable envelope signature verification for handler tests that use mock data.
// Tests that specifically exercise signature verification enable it per-test.
const savedEnvValue = process.env["VERIFY_ENVELOPE_SIGNATURES"];

beforeEach(() => {
  process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";
});

afterEach(() => {
  if (savedEnvValue === undefined) {
    delete process.env["VERIFY_ENVELOPE_SIGNATURES"];
  } else {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = savedEnvValue;
  }
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("handleManifestRequest", () => {
  it("returns a ManifestResponse with an empty document list", async () => {
    const relay = new EncryptedRelay();
    const systemId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();
    const message: ManifestRequest = {
      type: "ManifestRequest",
      correlationId,
      systemId,
    };

    const result = await handleManifestRequest(message, relay.asService());

    expect(result).toEqual({
      type: "ManifestResponse",
      correlationId,
      manifest: { documents: [], systemId },
    });
  });

  it("echoes the correlationId from the request", async () => {
    const relay = new EncryptedRelay();
    const correlationId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const message: ManifestRequest = {
      type: "ManifestRequest",
      correlationId,
      systemId,
    };

    const result = await handleManifestRequest(message, relay.asService());

    expect(result.correlationId).toBe(correlationId);
  });
});

describe("handleSubscribeRequest", () => {
  let manager: ConnectionManager;

  afterEach(() => {
    manager.closeAll(1001, "test cleanup");
  });

  it("registers subscriptions and returns catchup with changes", async () => {
    manager = new ConnectionManager();
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

    // Fill subscription cap (WS_MAX_SUBSCRIPTIONS_PER_CONNECTION defaults to 500)
    for (let i = 0; i < 500; i++) {
      manager.addSubscription(connId, `doc-fill-${String(i)}`);
    }

    // Now subscribe to one more doc that has data
    const extraDocId = crypto.randomUUID();
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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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
    const docId = crypto.randomUUID();
    const connId = crypto.randomUUID();
    const systemId = crypto.randomUUID();
    const auth = mockAuth();
    const state = createAuthenticatedState(manager, connId, auth, systemId as SystemId);

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

describe("handleFetchSnapshot", () => {
  it("returns the latest snapshot from the relay", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await relay.submitSnapshot(mockSnapshot(docId, 1));

    const message: FetchSnapshotRequest = {
      type: "FetchSnapshotRequest",
      correlationId,
      docId,
    };

    const result = await handleFetchSnapshot(message, relay.asService());

    expect(result.type).toBe("SnapshotResponse");
    expect(result.correlationId).toBe(correlationId);
    expect(result.docId).toBe(docId);
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.snapshotVersion).toBe(1);
  });

  it("returns null snapshot when no snapshot exists", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const message: FetchSnapshotRequest = {
      type: "FetchSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId,
    };

    const result = await handleFetchSnapshot(message, relay.asService());

    expect(result.snapshot).toBeNull();
  });
});

describe("handleFetchChanges", () => {
  it("returns changes since the given seq", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId,
      docId,
      sinceSeq: 1,
    };

    const result = await handleFetchChanges(message, relay.asService());

    expect(result.type).toBe("ChangesResponse");
    expect(result.correlationId).toBe(correlationId);
    expect(result.docId).toBe(docId);
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0]?.seq).toBe(2);
    expect(result.changes[1]?.seq).toBe(3);
  });

  it("returns empty array when no changes exist after sinceSeq", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    await relay.submit(mockChangeWithoutSeq(docId));

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: crypto.randomUUID(),
      docId,
      sinceSeq: 1,
    };

    const result = await handleFetchChanges(message, relay.asService());

    expect(result.changes).toHaveLength(0);
  });

  it("returns empty array for unknown document", async () => {
    const relay = new EncryptedRelay();

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: crypto.randomUUID(),
      docId: crypto.randomUUID(),
      sinceSeq: 0,
    };

    const result = await handleFetchChanges(message, relay.asService());

    expect(result.changes).toHaveLength(0);
  });

  it("passes WS_ENVELOPE_PAGE_SIZE as the limit parameter", async () => {
    const getEnvelopesSinceSpy = vi.fn().mockResolvedValue({ envelopes: [], hasMore: false });
    const mockService: SyncRelayService = {
      submit: vi.fn(),
      getEnvelopesSince: getEnvelopesSinceSpy,
      submitSnapshot: vi.fn(),
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      getManifest: vi.fn(),
    };

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: crypto.randomUUID(),
      docId: "doc-1",
      sinceSeq: 0,
    };

    await handleFetchChanges(message, mockService);

    expect(getEnvelopesSinceSpy).toHaveBeenCalledWith("doc-1", 0, 500);
  });
});

describe("handleSubmitChange", () => {
  it("assigns a seq and returns ChangeAccepted with the sequenced envelope", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId,
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService());
    expect(isSubmitChangeResult(result)).toBe(true);
    if (!isSubmitChangeResult(result)) return;

    expect(result.response.type).toBe("ChangeAccepted");
    expect(result.response.correlationId).toBe(correlationId);
    expect(result.response.docId).toBe(docId);
    expect(result.response.assignedSeq).toBe(1);
    expect(result.sequencedEnvelope.seq).toBe(1);
    expect(result.sequencedEnvelope.documentId).toBe(docId);
  });

  it("assigns monotonically increasing seq values", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const msg1: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };
    const msg2: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result1 = await handleSubmitChange(msg1, relay.asService());
    const result2 = await handleSubmitChange(msg2, relay.asService());

    expect(isSubmitChangeResult(result1)).toBe(true);
    expect(isSubmitChangeResult(result2)).toBe(true);
    if (!isSubmitChangeResult(result1) || !isSubmitChangeResult(result2)) return;

    expect(result1.response.assignedSeq).toBe(1);
    expect(result2.response.assignedSeq).toBe(2);
  });

  it("overrides documentId in the change with the request docId", async () => {
    const relay = new EncryptedRelay();
    const requestDocId = crypto.randomUUID();
    const differentDocId = crypto.randomUUID();

    const changeWithDifferentDoc = mockChangeWithoutSeq(differentDocId);

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId: requestDocId,
      change: changeWithDifferentDoc,
    };

    const result = await handleSubmitChange(message, relay.asService());
    expect(isSubmitChangeResult(result)).toBe(true);
    if (!isSubmitChangeResult(result)) return;

    expect(result.response.docId).toBe(requestDocId);
    expect(result.sequencedEnvelope.documentId).toBe(requestDocId);

    // Verify the relay stored it under the request docId
    const storedResult = await relay.getEnvelopesSince(requestDocId, 0);
    expect(storedResult.envelopes).toHaveLength(1);
    expect(storedResult.envelopes[0]?.documentId).toBe(requestDocId);
  });
});

describe("handleSubmitSnapshot", () => {
  it("returns SnapshotAccepted for a valid snapshot", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId,
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(message, relay.asService());

    expect(result.type).toBe("SnapshotAccepted");
    expect(result.correlationId).toBe(correlationId);
    if (result.type === "SnapshotAccepted") {
      expect(result.docId).toBe(docId);
      expect(result.snapshotVersion).toBe(1);
    }
  });

  it("returns SyncError with VERSION_CONFLICT when snapshot version is not newer", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    // Submit version 2 first
    await relay.submitSnapshot(mockSnapshot(docId, 2));

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(message, relay.asService());

    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("VERSION_CONFLICT");
      expect(result.docId).toBe(docId);
    }
  });

  it("returns SyncError when submitting the same version", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    await relay.submitSnapshot(mockSnapshot(docId, 1));

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId,
      snapshot: mockSnapshot(docId, 1),
    };

    const result = await handleSubmitSnapshot(message, relay.asService());

    expect(result.type).toBe("SyncError");
  });

  it("overrides documentId in the snapshot with the request docId", async () => {
    const relay = new EncryptedRelay();
    const requestDocId = crypto.randomUUID();
    const differentDocId = crypto.randomUUID();

    const message: SubmitSnapshotRequest = {
      type: "SubmitSnapshotRequest",
      correlationId: crypto.randomUUID(),
      docId: requestDocId,
      snapshot: mockSnapshot(differentDocId, 1),
    };

    const result = await handleSubmitSnapshot(message, relay.asService());

    expect(result.type).toBe("SnapshotAccepted");

    // Verify the relay stored it under the request docId
    const stored = await relay.getLatestSnapshot(requestDocId);
    expect(stored).not.toBeNull();
    expect(stored?.documentId).toBe(requestDocId);
  });
});

describe("handleDocumentLoad", () => {
  it("returns both snapshot and changes for the requested document", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await relay.submitSnapshot(mockSnapshot(docId, 1));
    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId,
      docId,
      persist: false,
    };

    const [snapshotResponse, changesResponse] = await handleDocumentLoad(
      message,
      relay.asService(),
    );

    expect(snapshotResponse.type).toBe("SnapshotResponse");
    expect(snapshotResponse.correlationId).toBe(correlationId);
    expect(snapshotResponse.docId).toBe(docId);
    expect(snapshotResponse.snapshot).not.toBeNull();
    expect(snapshotResponse.snapshot?.snapshotVersion).toBe(1);

    expect(changesResponse.type).toBe("ChangesResponse");
    expect(changesResponse.correlationId).toBe(correlationId);
    expect(changesResponse.docId).toBe(docId);
    // P-H2: With a snapshot at version 1, only changes after seq 1 are returned
    expect(changesResponse.changes).toHaveLength(1);
  });

  it("returns null snapshot when none exists", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    await relay.submit(mockChangeWithoutSeq(docId));

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: crypto.randomUUID(),
      docId,
      persist: true,
    };

    const [snapshotResponse, changesResponse] = await handleDocumentLoad(
      message,
      relay.asService(),
    );

    expect(snapshotResponse.snapshot).toBeNull();
    expect(changesResponse.changes).toHaveLength(1);
  });

  it("returns empty changes and null snapshot for unknown document", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: crypto.randomUUID(),
      docId,
      persist: false,
    };

    const [snapshotResponse, changesResponse] = await handleDocumentLoad(
      message,
      relay.asService(),
    );

    expect(snapshotResponse.snapshot).toBeNull();
    expect(changesResponse.changes).toHaveLength(0);
  });

  it("returns all changes from seq 0 when no snapshot exists", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: crypto.randomUUID(),
      docId,
      persist: false,
    };

    const [, changesResponse] = await handleDocumentLoad(message, relay.asService());

    expect(changesResponse.changes).toHaveLength(3);
    expect(changesResponse.changes[0]?.seq).toBe(1);
    expect(changesResponse.changes[1]?.seq).toBe(2);
    expect(changesResponse.changes[2]?.seq).toBe(3);
  });

  it("fetches only changes after snapshot version when snapshot exists (P-H2)", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    // Submit 5 changes (seq 1..5)
    for (let i = 0; i < 5; i++) {
      await relay.submit(mockChangeWithoutSeq(docId));
    }
    // Submit a snapshot at version 3 (simulating snapshot covering seqs 1..3)
    await relay.submitSnapshot(mockSnapshot(docId, 3));

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: crypto.randomUUID(),
      docId,
      persist: false,
    };

    const [snapshotResponse, changesResponse] = await handleDocumentLoad(
      message,
      relay.asService(),
    );

    expect(snapshotResponse.snapshot).not.toBeNull();
    expect(snapshotResponse.snapshot?.snapshotVersion).toBe(3);
    // Only changes with seq > 3 should be returned
    expect(changesResponse.changes).toHaveLength(2);
    expect(changesResponse.changes[0]?.seq).toBe(4);
    expect(changesResponse.changes[1]?.seq).toBe(5);
  });
});

// ── P-H1: Pagination tests ──────────────────────────────────────────

describe("getEnvelopesSince pagination via asService() (P-H1)", () => {
  it("returns hasMore: false when results fit within the limit", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));

    const service = relay.asService();
    const result = await service.getEnvelopesSince(docId, 0, 10);

    expect(result.envelopes).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("returns hasMore: true when more results exist beyond the limit", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    for (let i = 0; i < 5; i++) {
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const service = relay.asService();
    const result = await service.getEnvelopesSince(docId, 0, 3);

    expect(result.envelopes).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });

  it("returns hasMore: false when results exactly match the limit", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    for (let i = 0; i < 3; i++) {
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const service = relay.asService();
    const result = await service.getEnvelopesSince(docId, 0, 3);

    expect(result.envelopes).toHaveLength(3);
    expect(result.hasMore).toBe(false);
  });

  it("supports cursor-based pagination using the last returned seq", async () => {
    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    for (let i = 0; i < 5; i++) {
      await relay.submit(mockChangeWithoutSeq(docId));
    }

    const service = relay.asService();
    // First page
    const page1 = await service.getEnvelopesSince(docId, 0, 2);
    expect(page1.envelopes).toHaveLength(2);
    expect(page1.hasMore).toBe(true);

    // Second page (use last envelope's seq as cursor)
    const lastSeq = page1.envelopes[1]?.seq ?? 0;
    const page2 = await service.getEnvelopesSince(docId, lastSeq, 2);
    expect(page2.envelopes).toHaveLength(2);
    expect(page2.hasMore).toBe(true);

    // Third page
    const lastSeq2 = page2.envelopes[1]?.seq ?? 0;
    const page3 = await service.getEnvelopesSince(docId, lastSeq2, 2);
    expect(page3.envelopes).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });
});

// ── Sec-M2: Signature verification tests ────────────────────────────

describe("handleSubmitChange envelope signature verification (Sec-M2)", () => {
  beforeAll(async () => {
    await initSodium();
  });

  it("returns SyncError with INVALID_ENVELOPE when verification is enabled and signature is invalid", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "true";

    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    // Mock data has random bytes as signatures — they will fail verification
    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService());

    expect(isSubmitChangeResult(result)).toBe(false);
    if (!isSubmitChangeResult(result)) {
      expect(result.type).toBe("SyncError");
      expect(result.code).toBe("INVALID_ENVELOPE");
      expect(result.docId).toBe(docId);
    }

    // Verify nothing was stored in the relay
    const stored = await relay.getEnvelopesSince(docId, 0);
    expect(stored.envelopes).toHaveLength(0);
  });

  it("accepts the envelope when verification is disabled via env var", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";

    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService());

    expect(isSubmitChangeResult(result)).toBe(true);
  });

  it("accepts the envelope when VERIFY_ENVELOPE_SIGNATURES is '0'", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "0";

    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: mockChangeWithoutSeq(docId),
    };

    const result = await handleSubmitChange(message, relay.asService());

    expect(isSubmitChangeResult(result)).toBe(true);
  });

  it("accepts a properly signed envelope when verification is enabled", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "true";

    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const sodium = getSodium();
    const { publicKey, secretKey } = sodium.signKeypair();
    const ciphertext = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const signature = sodium.signDetached(ciphertext, secretKey);

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: {
        ciphertext,
        nonce: nonce(1),
        signature,
        authorPublicKey: publicKey,
        documentId: docId,
      },
    };

    const result = await handleSubmitChange(message, relay.asService());

    expect(isSubmitChangeResult(result)).toBe(true);
    if (isSubmitChangeResult(result)) {
      expect(result.response.type).toBe("ChangeAccepted");
      expect(result.response.assignedSeq).toBe(1);
    }
  });

  it("returns INVALID_ENVELOPE when envelope fields have wrong byte lengths", async () => {
    process.env["VERIFY_ENVELOPE_SIGNATURES"] = "true";

    const relay = new EncryptedRelay();
    const docId = crypto.randomUUID();

    const message: SubmitChangeRequest = {
      type: "SubmitChangeRequest",
      correlationId: crypto.randomUUID(),
      docId,
      change: {
        ciphertext: new Uint8Array([0xde, 0xad]),
        nonce: nonce(1),
        // 10-byte signature instead of required 64 bytes
        signature: new Uint8Array(10) as never,
        authorPublicKey: pubkey(0x05),
        documentId: docId,
      },
    };

    const result = await handleSubmitChange(message, relay.asService());

    expect(isSubmitChangeResult(result)).toBe(false);
    if (!isSubmitChangeResult(result)) {
      expect(result.type).toBe("SyncError");
      expect(result.code).toBe("INVALID_ENVELOPE");
    }

    // Nothing stored
    const stored = await relay.getEnvelopesSince(docId, 0);
    expect(stored.envelopes).toHaveLength(0);
  });
});
