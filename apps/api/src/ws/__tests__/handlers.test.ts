/**
 * Branch coverage for apps/api/src/ws/handlers.ts.
 *
 * Covers all branches not reached by the message-router integration path:
 *   - shouldVerifyEnvelopeSignatures: mock control (false default, override to true)
 *   - handleSubmitChange: verification disabled path (no-verify fast path)
 *   - handleSubmitChange: InvalidInputError from getSodium → SyncError
 *   - handleSubmitChange: verifyEnvelopeSignature returns false → SyncError
 *   - handleSubmitChange: EnvelopeLimitExceededError → SyncError QUOTA_EXCEEDED
 *   - handleSubmitChange: relay.submit throws unknown error → rethrows
 *   - handleSubmitChange: UNAUTHORIZED_KEY when authorPublicKey not in account keys
 *   - handleSubmitSnapshot: SnapshotVersionConflictError → SyncError VERSION_CONFLICT
 *   - handleSubmitSnapshot: SnapshotSizeLimitExceededError → SyncError QUOTA_EXCEEDED
 *   - handleSubmitSnapshot: success path
 *   - handleSubmitSnapshot: INVALID_ENVELOPE when snapshot signature is invalid
 *   - handleSubmitSnapshot: UNAUTHORIZED_KEY when snapshot authorPublicKey not in account keys
 *   - verifyEnvelopeOrError: disabled path, invalid sig, valid sig
 *   - verifyKeyOwnership: matching key, no match, empty keys, multiple keys
 *   - handleSubscribeRequest: addSubscription returns false (drop)
 *   - handleSubscribeRequest: hasNewerSnapshot true / false
 *   - handleSubscribeRequest: catchup fetch throws → drops doc
 *   - handleFetchChanges: collectAllEnvelopes multi-page (hasMore loop)
 *   - collectAllEnvelopes: last envelope undefined guard (!last break)
 *   - handleDocumentLoad: snapshot null → sinceSeq = 0
 *   - handleDocumentLoad: snapshot present → sinceSeq = snapshotVersion
 *   - handleManifestRequest: success
 *   - handleUnsubscribeRequest: removes subscription
 *   - handleFetchSnapshot: returns snapshot from relay
 */
import {
  InvalidInputError,
  assertAeadNonce,
  assertSignPublicKey,
  assertSignature,
  initSodium,
} from "@pluralscape/crypto";
import {
  EnvelopeLimitExceededError,
  SnapshotSizeLimitExceededError,
  SnapshotVersionConflictError,
} from "@pluralscape/sync";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Disable envelope signature verification before module load.
// The IIFE in envelope-verification-config.ts reads this at import time.
vi.hoisted(() => {
  process.env["VERIFY_ENVELOPE_SIGNATURES"] = "false";
});

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { ConnectionManager } from "../connection-manager.js";
import {
  handleDocumentLoad,
  handleFetchChanges,
  handleFetchSnapshot,
  handleManifestRequest,
  handleSubmitChange,
  handleSubmitSnapshot,
  handleSubscribeRequest,
  handleUnsubscribeRequest,
  verifyEnvelopeOrError,
  verifyKeyOwnership,
} from "../handlers.js";

import { shouldVerifyEnvelopeSignatures } from "../envelope-verification-config.js";

import type { AppLogger } from "../../lib/logger.js";
import type { SyncRelayService, PaginatedEnvelopes } from "@pluralscape/sync";
import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  ManifestRequest,
  FetchSnapshotRequest,
  FetchChangesRequest,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SubscribeRequest,
  UnsubscribeRequest,
  DocumentLoadRequest,
} from "@pluralscape/sync";
import type { SyncDocumentId, SystemId, AccountId, SessionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Harness helpers ───────────────────────────────────────────────────

function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function mockRelay(): {
  relay: SyncRelayService;
  submit: ReturnType<typeof vi.fn>;
  getEnvelopesSince: ReturnType<typeof vi.fn>;
  submitSnapshot: ReturnType<typeof vi.fn>;
  getLatestSnapshot: ReturnType<typeof vi.fn>;
  getManifest: ReturnType<typeof vi.fn>;
} {
  const submit = vi.fn().mockResolvedValue(1);
  const getEnvelopesSince = vi
    .fn()
    .mockResolvedValue({ envelopes: [], hasMore: false } satisfies PaginatedEnvelopes);
  const submitSnapshot = vi.fn().mockResolvedValue(undefined);
  const getLatestSnapshot = vi.fn().mockResolvedValue(null);
  const getManifest = vi.fn().mockResolvedValue({ documents: [] });

  const relay: SyncRelayService = {
    submit,
    getEnvelopesSince,
    submitSnapshot,
    getLatestSnapshot,
    getManifest,
  };
  return { relay, submit, getEnvelopesSince, submitSnapshot, getLatestSnapshot, getManifest };
}

const TEST_ACCOUNT_ID = "acct_h_test" as AccountId;

/**
 * Create a mock DB that returns the given public keys for the test account.
 * Uses the drizzle query-builder chain pattern: db.select().from().where() → rows.
 */
function mockDb(publicKeys: Uint8Array[] = []): PostgresJsDatabase {
  const rows = publicKeys.map((pk) => ({ publicKey: pk }));
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
  const db = {
    select: vi.fn().mockReturnValue(chain),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return db as never as PostgresJsDatabase;
}

function brandedBytes(size: number, fill: number) {
  const nonce = new Uint8Array(24).fill(fill);
  assertAeadNonce(nonce);
  const sig = new Uint8Array(64).fill(fill);
  assertSignature(sig);
  const key = new Uint8Array(32).fill(fill);
  assertSignPublicKey(key);
  const ct = new Uint8Array(size).fill(fill);
  return { nonce, sig, key, ct };
}

function makeEnvelope(docId: string, seq: number, fill = 0): EncryptedChangeEnvelope {
  const { nonce, sig, key, ct } = brandedBytes(32, fill);
  return {
    ciphertext: ct,
    nonce,
    signature: sig,
    authorPublicKey: key,
    documentId: docId as SyncDocumentId,
    seq,
  };
}

function makeSnapshotEnvelope(docId: string, snapshotVersion: number): EncryptedSnapshotEnvelope {
  const nonce = new Uint8Array(24).fill(2);
  assertAeadNonce(nonce);
  const sig = new Uint8Array(64).fill(3);
  assertSignature(sig);
  const key = new Uint8Array(32).fill(4);
  assertSignPublicKey(key);
  return {
    ciphertext: new Uint8Array(32).fill(1),
    nonce,
    signature: sig,
    authorPublicKey: key,
    documentId: docId as SyncDocumentId,
    snapshotVersion,
  };
}

function makeConnectionState(connectionId: string) {
  const manager = new ConnectionManager();
  const ws = { close: vi.fn(), send: vi.fn() };
  manager.reserveUnauthSlot();
  manager.register(connectionId, ws as never, Date.now());
  manager.authenticate(
    connectionId,
    {
      authMethod: "session" as const,
      accountId: "acct_h_test" as AccountId,
      systemId: "sys_h_test" as SystemId,
      sessionId: "sess_h_test" as SessionId,
      accountType: "system",
      ownedSystemIds: new Set(["sys_h_test" as SystemId]),
      auditLogIpTracking: false,
    },
    "sys_h_test" as SystemId,
    "owner-full",
  );
  const state = manager.get(connectionId);
  if (!state) throw new Error(`State missing for ${connectionId}`);
  return { state, manager, ws };
}

// ── Test setup ────────────────────────────────────────────────────────

const configMod = await import("../envelope-verification-config.js");

function enableVerification(): void {
  vi.spyOn(configMod, "shouldVerifyEnvelopeSignatures").mockReturnValue(true);
}

beforeAll(async () => {
  await initSodium();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── shouldVerifyEnvelopeSignatures ────────────────────────────────────
// The real startup-cached IIFE is tested in the integration test file
// (apps/api/src/__tests__/ws/handlers.test.ts). Here we only verify
// that the mock controls the verification bypass correctly.

describe("shouldVerifyEnvelopeSignatures (startup-cached)", () => {
  it("returns false because VERIFY_ENVELOPE_SIGNATURES=false was set before module load", () => {
    expect(shouldVerifyEnvelopeSignatures()).toBe(false);
  });
});

// ── handleManifestRequest ─────────────────────────────────────────────

describe("handleManifestRequest", () => {
  it("returns ManifestResponse with relay manifest", async () => {
    const { relay, getManifest } = mockRelay();
    const manifest = { documents: [{ documentId: "doc-m-1", latestSeq: 5, snapshotVersion: 1 }] };
    getManifest.mockResolvedValue(manifest);

    const message: ManifestRequest = {
      type: "ManifestRequest",
      correlationId: "corr-m-1",
      systemId: "sys_h_test" as SystemId,
    };

    const result = await handleManifestRequest(message, relay);
    expect(result.type).toBe("ManifestResponse");
    expect(result.correlationId).toBe("corr-m-1");
    expect(result.manifest).toBe(manifest);
  });
});

// ── handleFetchSnapshot ───────────────────────────────────────────────

describe("handleFetchSnapshot", () => {
  it("returns SnapshotResponse with null snapshot when none exists", async () => {
    const { relay } = mockRelay();

    const message: FetchSnapshotRequest = {
      type: "FetchSnapshotRequest",
      correlationId: "corr-fs-1",
      docId: "doc-fs-1" as SyncDocumentId,
    };

    const result = await handleFetchSnapshot(message, relay);
    expect(result.type).toBe("SnapshotResponse");
    expect(result.snapshot).toBeNull();
    expect(result.docId).toBe("doc-fs-1");
  });

  it("returns SnapshotResponse with snapshot when one exists", async () => {
    const { relay, getLatestSnapshot } = mockRelay();
    const snap = makeSnapshotEnvelope("doc-fs-2", 10);
    getLatestSnapshot.mockResolvedValue(snap);

    const message: FetchSnapshotRequest = {
      type: "FetchSnapshotRequest",
      correlationId: "corr-fs-2",
      docId: "doc-fs-2" as SyncDocumentId,
    };

    const result = await handleFetchSnapshot(message, relay);
    expect(result.snapshot).toBe(snap);
  });
});

// ── handleFetchChanges / collectAllEnvelopes ──────────────────────────

describe("handleFetchChanges", () => {
  it("returns empty changes when no envelopes exist", async () => {
    const { relay } = mockRelay();

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: "corr-fc-1",
      docId: "doc-fc-1" as SyncDocumentId,
      sinceSeq: 0,
    };

    const result = await handleFetchChanges(message, relay);
    expect(result.type).toBe("ChangesResponse");
    expect(result.changes).toHaveLength(0);
  });

  it("accumulates envelopes across multiple pages (hasMore=true loop)", async () => {
    const { relay, getEnvelopesSince } = mockRelay();

    const env1 = makeEnvelope("doc-fc-paged", 1, 1);
    const env2 = makeEnvelope("doc-fc-paged", 2, 2);

    // First page: hasMore=true, second page: hasMore=false
    getEnvelopesSince
      .mockResolvedValueOnce({ envelopes: [env1], hasMore: true } satisfies PaginatedEnvelopes)
      .mockResolvedValueOnce({ envelopes: [env2], hasMore: false } satisfies PaginatedEnvelopes);

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: "corr-fc-paged",
      docId: "doc-fc-paged" as SyncDocumentId,
      sinceSeq: 0,
    };

    const result = await handleFetchChanges(message, relay);
    expect(result.changes).toHaveLength(2);
    expect(getEnvelopesSince).toHaveBeenCalledTimes(2);
  });

  it("breaks when page is empty even if hasMore=true (defensive guard)", async () => {
    const { relay, getEnvelopesSince } = mockRelay();

    // hasMore=true but empty envelopes — should break immediately
    getEnvelopesSince.mockResolvedValueOnce({
      envelopes: [],
      hasMore: true,
    } satisfies PaginatedEnvelopes);

    const message: FetchChangesRequest = {
      type: "FetchChangesRequest",
      correlationId: "corr-fc-empty",
      docId: "doc-fc-empty" as SyncDocumentId,
      sinceSeq: 0,
    };

    const result = await handleFetchChanges(message, relay);
    expect(result.changes).toHaveLength(0);
    expect(getEnvelopesSince).toHaveBeenCalledTimes(1);
  });
});

// ── handleSubmitChange ────────────────────────────────────────────────

describe("handleSubmitChange", () => {
  function makeSubmitMsg(docId = "doc-sc-1"): SubmitChangeRequest {
    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    return {
      type: "SubmitChangeRequest",
      correlationId: "corr-sc",
      docId: docId as SyncDocumentId,
      change: {
        ciphertext: ct,
        nonce,
        signature: sig,
        authorPublicKey: key,
        documentId: docId as SyncDocumentId,
      },
    };
  }

  /** Key bytes used by makeSubmitMsg (fill=1, size=32). */
  const validKeyBytes = new Uint8Array(32).fill(1);

  it("skips verification and returns SubmitChangeResult when verification disabled", async () => {
    vi.restoreAllMocks();
    const { relay, submit } = mockRelay();
    submit.mockResolvedValue(42);
    const db = mockDb([validKeyBytes]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-nocheck"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SubmitChangeResult");
    if (result.type === "SubmitChangeResult") {
      expect(result.response.assignedSeq).toBe(42);
    }
  });

  it("returns SyncError INVALID_ENVELOPE when InvalidInputError thrown by getSodium", async () => {
    enableVerification();

    // Mock getSodium to throw InvalidInputError
    const cryptoModule = await import("@pluralscape/crypto");
    vi.spyOn(cryptoModule, "getSodium").mockImplementation(() => {
      throw new InvalidInputError("sodium not ready");
    });

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-inv"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("rethrows non-InvalidInputError thrown by getSodium", async () => {
    enableVerification();

    const cryptoModule = await import("@pluralscape/crypto");
    vi.spyOn(cryptoModule, "getSodium").mockImplementation(() => {
      throw new Error("unexpected sodium error");
    });

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    await expect(
      handleSubmitChange(makeSubmitMsg("doc-sc-rethrow"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected sodium error");
  });

  it("returns SyncError INVALID_ENVELOPE when verifyEnvelopeSignature returns false", async () => {
    enableVerification();

    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { relay } = mockRelay();
    const db = mockDb([validKeyBytes]);
    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-false"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when authorPublicKey does not match account keys", async () => {
    vi.restoreAllMocks();
    const { relay } = mockRelay();
    // DB returns a different key than the one in the envelope
    const differentKey = new Uint8Array(32).fill(99);
    const db = mockDb([differentKey]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-badkey"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when account has no keys", async () => {
    vi.restoreAllMocks();
    const { relay } = mockRelay();
    const db = mockDb([]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-nokeys"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError QUOTA_EXCEEDED when relay.submit throws EnvelopeLimitExceededError", async () => {
    vi.restoreAllMocks();
    const { relay, submit } = mockRelay();
    submit.mockRejectedValue(new EnvelopeLimitExceededError("doc-sc-quota", 1000));
    const db = mockDb([validKeyBytes]);

    const result = await handleSubmitChange(
      makeSubmitMsg("doc-sc-quota"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("rethrows unknown errors from relay.submit", async () => {
    vi.restoreAllMocks();
    const { relay, submit } = mockRelay();
    submit.mockRejectedValue(new Error("unexpected relay error"));
    const db = mockDb([validKeyBytes]);

    await expect(
      handleSubmitChange(makeSubmitMsg("doc-sc-unknown"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected relay error");
  });
});

// ── handleSubmitSnapshot ──────────────────────────────────────────────

describe("handleSubmitSnapshot", () => {
  /** Key bytes used by makeSubmitSnapshotMsg (fill=1, size=32). */
  const validSnapshotKeyBytes = new Uint8Array(32).fill(1);

  function makeSubmitSnapshotMsg(docId = "doc-ss-1"): SubmitSnapshotRequest {
    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    return {
      type: "SubmitSnapshotRequest",
      correlationId: "corr-ss",
      docId: docId as SyncDocumentId,
      snapshot: {
        ciphertext: ct,
        nonce,
        signature: sig,
        authorPublicKey: key,
        documentId: docId as SyncDocumentId,
        snapshotVersion: 5,
      },
    };
  }

  it("returns SnapshotAccepted on success", async () => {
    vi.restoreAllMocks();
    const { relay } = mockRelay();
    const db = mockDb([validSnapshotKeyBytes]);
    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-ok"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SnapshotAccepted");
    if (result.type === "SnapshotAccepted") {
      expect(result.snapshotVersion).toBe(5);
    }
  });

  it("returns SyncError INVALID_ENVELOPE when snapshot signature is invalid", async () => {
    enableVerification();

    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { relay } = mockRelay();
    const db = mockDb([validSnapshotKeyBytes]);
    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-badsig"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("INVALID_ENVELOPE");
    }
  });

  it("returns SyncError UNAUTHORIZED_KEY when snapshot authorPublicKey does not match account", async () => {
    vi.restoreAllMocks();
    const { relay } = mockRelay();
    const differentKey = new Uint8Array(32).fill(99);
    const db = mockDb([differentKey]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-badkey"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("UNAUTHORIZED_KEY");
    }
  });

  it("returns SyncError VERSION_CONFLICT on SnapshotVersionConflictError", async () => {
    vi.restoreAllMocks();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new SnapshotVersionConflictError(6, 5));
    const db = mockDb([validSnapshotKeyBytes]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-vc"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("VERSION_CONFLICT");
    }
  });

  it("returns SyncError QUOTA_EXCEEDED on SnapshotSizeLimitExceededError", async () => {
    vi.restoreAllMocks();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new SnapshotSizeLimitExceededError("doc-ss-size", 2000, 1000));
    const db = mockDb([validSnapshotKeyBytes]);

    const result = await handleSubmitSnapshot(
      makeSubmitSnapshotMsg("doc-ss-size"),
      relay,
      db,
      TEST_ACCOUNT_ID,
    );
    expect(result.type).toBe("SyncError");
    if (result.type === "SyncError") {
      expect(result.code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("rethrows unknown errors from relay.submitSnapshot", async () => {
    vi.restoreAllMocks();
    const { relay, submitSnapshot } = mockRelay();
    submitSnapshot.mockRejectedValue(new Error("unexpected snapshot error"));
    const db = mockDb([validSnapshotKeyBytes]);

    await expect(
      handleSubmitSnapshot(makeSubmitSnapshotMsg("doc-ss-unk"), relay, db, TEST_ACCOUNT_ID),
    ).rejects.toThrow("unexpected snapshot error");
  });
});

// ── handleSubscribeRequest ────────────────────────────────────────────

describe("handleSubscribeRequest", () => {
  it("drops documents when subscription cap is reached (addSubscription returns false)", async () => {
    const { state, manager } = makeConnectionState("conn-sub-cap");
    const { relay } = mockRelay();
    const log = mockLog();

    // Fill the subscription cap by manually adding subscriptions up to the limit
    // The default WS_MAX_SUBSCRIPTIONS_PER_CONNECTION is in ws.constants.ts
    // Instead, mock addSubscription to return false for our test doc
    vi.spyOn(manager, "addSubscription").mockReturnValue(false);

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: "corr-sub-cap",
      documents: [
        { docId: "doc-cap-1" as SyncDocumentId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay, log);
    expect(result.droppedDocIds).toContain("doc-cap-1");
    expect(result.catchup).toHaveLength(0);
    expect((log.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);

    manager.closeAll(1001, "test cleanup");
  });

  it("returns null catchup entry when no changes and no newer snapshot", async () => {
    const { state, manager } = makeConnectionState("conn-sub-null");
    const { relay } = mockRelay();
    const log = mockLog();

    // No changes, no snapshot
    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: "corr-sub-null",
      documents: [
        { docId: "doc-sub-null-1" as SyncDocumentId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay, log);
    expect(result.catchup).toHaveLength(0);
    expect(result.droppedDocIds).toHaveLength(0);

    manager.closeAll(1001, "test cleanup");
  });

  it("includes snapshot in catchup when snapshot is newer than lastSnapshotVersion", async () => {
    const { state, manager } = makeConnectionState("conn-sub-snap");
    const { relay, getLatestSnapshot } = mockRelay();
    const log = mockLog();

    const snap = makeSnapshotEnvelope("doc-sub-snap", 10);
    getLatestSnapshot.mockResolvedValue(snap);

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: "corr-sub-snap",
      documents: [
        { docId: "doc-sub-snap" as SyncDocumentId, lastSyncedSeq: 0, lastSnapshotVersion: 5 },
      ],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay, log);
    expect(result.catchup).toHaveLength(1);
    expect(result.catchup[0]?.snapshot).toBe(snap);

    manager.closeAll(1001, "test cleanup");
  });

  it("excludes snapshot from catchup when snapshot version is not newer", async () => {
    const { state, manager } = makeConnectionState("conn-sub-nosnap");
    const { relay, getLatestSnapshot, getEnvelopesSince } = mockRelay();
    const log = mockLog();

    const snap = makeSnapshotEnvelope("doc-sub-nosnap", 5);
    getLatestSnapshot.mockResolvedValue(snap);

    // Add a change so catchup is triggered (changes.length > 0)
    const env = makeEnvelope("doc-sub-nosnap", 1, 1);
    getEnvelopesSince.mockResolvedValue({ envelopes: [env], hasMore: false });

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: "corr-sub-nosnap",
      documents: [
        { docId: "doc-sub-nosnap" as SyncDocumentId, lastSyncedSeq: 0, lastSnapshotVersion: 5 },
      ],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay, log);
    expect(result.catchup).toHaveLength(1);
    // Snapshot not newer, so it should be null in catchup
    expect(result.catchup[0]?.snapshot).toBeNull();

    manager.closeAll(1001, "test cleanup");
  });

  it("drops document and logs error when catchup fetch throws", async () => {
    const { state, manager } = makeConnectionState("conn-sub-err");
    const { relay, getEnvelopesSince } = mockRelay();
    const log = mockLog();

    getEnvelopesSince.mockRejectedValue(new Error("relay down"));

    const message: SubscribeRequest = {
      type: "SubscribeRequest",
      correlationId: "corr-sub-err",
      documents: [
        { docId: "doc-sub-err-1" as SyncDocumentId, lastSyncedSeq: 0, lastSnapshotVersion: 0 },
      ],
    };

    const result = await handleSubscribeRequest(message, state, manager, relay, log);
    expect(result.droppedDocIds).toContain("doc-sub-err-1");
    expect(result.catchup).toHaveLength(0);
    expect((log.error as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);

    manager.closeAll(1001, "test cleanup");
  });
});

// ── handleUnsubscribeRequest ──────────────────────────────────────────

describe("handleUnsubscribeRequest", () => {
  it("removes subscription via manager (idempotent)", () => {
    const { state, manager } = makeConnectionState("conn-unsub");
    manager.addSubscription("conn-unsub", "doc-unsub-1" as SyncDocumentId);

    const message: UnsubscribeRequest = {
      type: "UnsubscribeRequest",
      correlationId: "corr-unsub",
      docId: "doc-unsub-1" as SyncDocumentId,
    };

    handleUnsubscribeRequest(message, state, manager);
    expect(manager.getSubscribers("doc-unsub-1" as SyncDocumentId).size).toBe(0);

    manager.closeAll(1001, "test cleanup");
  });
});

// ── handleDocumentLoad ────────────────────────────────────────────────

describe("handleDocumentLoad", () => {
  it("uses sinceSeq=0 when no snapshot exists", async () => {
    const { relay, getEnvelopesSince } = mockRelay();

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: "corr-dl-1",
      docId: "doc-dl-1" as SyncDocumentId,
      persist: true,
    };

    const [snapshotResp, changesResp] = await handleDocumentLoad(message, relay);
    expect(snapshotResp.snapshot).toBeNull();
    expect(changesResp.changes).toHaveLength(0);
    // sinceSeq should be 0 when no snapshot
    expect(getEnvelopesSince).toHaveBeenCalledWith("doc-dl-1", 0, expect.any(Number));
  });

  it("uses snapshotVersion as sinceSeq when snapshot exists", async () => {
    const { relay, getLatestSnapshot, getEnvelopesSince } = mockRelay();

    const snap = makeSnapshotEnvelope("doc-dl-2", 15);
    getLatestSnapshot.mockResolvedValue(snap);

    const message: DocumentLoadRequest = {
      type: "DocumentLoadRequest",
      correlationId: "corr-dl-2",
      docId: "doc-dl-2" as SyncDocumentId,
      persist: true,
    };

    const [snapshotResp, changesResp] = await handleDocumentLoad(message, relay);
    expect(snapshotResp.snapshot).toBe(snap);
    expect(changesResp.changes).toHaveLength(0);
    // sinceSeq should be snapshotVersion=15 when snapshot exists
    expect(getEnvelopesSince).toHaveBeenCalledWith("doc-dl-2", 15, expect.any(Number));
  });
});

// ── verifyEnvelopeOrError ────────────────────────────────────────────

describe("verifyEnvelopeOrError", () => {
  it("returns null when verification is disabled", () => {
    vi.restoreAllMocks();
    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-1",
      "doc-ve-1" as SyncDocumentId,
    );
    expect(result).toBeNull();
  });

  it("returns SyncError INVALID_ENVELOPE when signature is invalid", async () => {
    enableVerification();
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-2",
      "doc-ve-2" as SyncDocumentId,
    );
    expect(result).not.toBeNull();
    expect(result?.code).toBe("INVALID_ENVELOPE");
  });

  it("returns null when signature is valid", async () => {
    enableVerification();
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(true);

    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-3",
      "doc-ve-3" as SyncDocumentId,
    );
    expect(result).toBeNull();
  });
});

// ── verifyKeyOwnership ───────────────────────────────────────────────

describe("verifyKeyOwnership", () => {
  it("returns null when authorPublicKey matches an account key", async () => {
    const key = new Uint8Array(32).fill(7);
    const db = mockDb([key]);

    const result = await verifyKeyOwnership(
      db,
      TEST_ACCOUNT_ID,
      key,
      "corr-ko-1",
      "doc-ko-1" as SyncDocumentId,
    );
    expect(result).toBeNull();
  });

  it("returns SyncError UNAUTHORIZED_KEY when no keys match", async () => {
    const envelopeKey = new Uint8Array(32).fill(7);
    const accountKey = new Uint8Array(32).fill(8);
    const db = mockDb([accountKey]);

    const result = await verifyKeyOwnership(
      db,
      TEST_ACCOUNT_ID,
      envelopeKey,
      "corr-ko-2",
      "doc-ko-2" as SyncDocumentId,
    );
    expect(result).not.toBeNull();
    expect(result?.code).toBe("UNAUTHORIZED_KEY");
  });

  it("returns SyncError UNAUTHORIZED_KEY when account has no keys", async () => {
    const envelopeKey = new Uint8Array(32).fill(7);
    const db = mockDb([]);

    const result = await verifyKeyOwnership(
      db,
      TEST_ACCOUNT_ID,
      envelopeKey,
      "corr-ko-3",
      "doc-ko-3" as SyncDocumentId,
    );
    expect(result).not.toBeNull();
    expect(result?.code).toBe("UNAUTHORIZED_KEY");
  });

  it("matches when account has multiple keys and one matches", async () => {
    const envelopeKey = new Uint8Array(32).fill(7);
    const otherKey = new Uint8Array(32).fill(8);
    const db = mockDb([otherKey, envelopeKey]);

    const result = await verifyKeyOwnership(
      db,
      TEST_ACCOUNT_ID,
      envelopeKey,
      "corr-ko-4",
      "doc-ko-4" as SyncDocumentId,
    );
    expect(result).toBeNull();
  });
});
