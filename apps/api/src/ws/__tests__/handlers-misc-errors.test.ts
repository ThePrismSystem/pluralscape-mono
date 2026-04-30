/**
 * Branch coverage for `apps/api/src/ws/handlers.ts` — non-submit paths.
 *
 * Covers manifest, fetchSnapshot, fetchChanges (incl. multi-page collect),
 * subscribe (cap drop / catchup branches / catchup error), unsubscribe,
 * documentLoad sinceSeq selection, verifyEnvelopeOrError, verifyKeyOwnership.
 */
import { InvalidInputError, initSodium } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  handleDocumentLoad,
  handleFetchChanges,
  handleFetchSnapshot,
  handleManifestRequest,
  handleSubscribeRequest,
  handleUnsubscribeRequest,
  verifyEnvelopeOrError,
  verifyKeyOwnership,
} from "../handlers.js";

import {
  TEST_ACCOUNT_ID,
  brandedBytes,
  makeConnectionState,
  makeEnvelope,
  makeSnapshotEnvelope,
  mockDb,
  mockLog,
  mockRelay,
} from "./handlers-fixtures.js";

import type { PaginatedEnvelopes } from "@pluralscape/sync";
import type {
  DocumentLoadRequest,
  FetchChangesRequest,
  FetchSnapshotRequest,
  ManifestRequest,
  SubscribeRequest,
  UnsubscribeRequest,
} from "@pluralscape/sync";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

beforeAll(async () => {
  await initSodium();
});

afterEach(() => {
  vi.restoreAllMocks();
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
      systemId: brandId<SystemId>("sys_h_test"),
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
      docId: brandId<SyncDocumentId>("doc-fs-1"),
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
      docId: brandId<SyncDocumentId>("doc-fs-2"),
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
      docId: brandId<SyncDocumentId>("doc-fc-1"),
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
      docId: brandId<SyncDocumentId>("doc-fc-paged"),
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
      docId: brandId<SyncDocumentId>("doc-fc-empty"),
      sinceSeq: 0,
    };

    const result = await handleFetchChanges(message, relay);
    expect(result.changes).toHaveLength(0);
    expect(getEnvelopesSince).toHaveBeenCalledTimes(1);
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
        { docId: brandId<SyncDocumentId>("doc-cap-1"), lastSyncedSeq: 0, lastSnapshotVersion: 0 },
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
        {
          docId: brandId<SyncDocumentId>("doc-sub-null-1"),
          lastSyncedSeq: 0,
          lastSnapshotVersion: 0,
        },
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
        {
          docId: brandId<SyncDocumentId>("doc-sub-snap"),
          lastSyncedSeq: 0,
          lastSnapshotVersion: 5,
        },
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
        {
          docId: brandId<SyncDocumentId>("doc-sub-nosnap"),
          lastSyncedSeq: 0,
          lastSnapshotVersion: 5,
        },
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
        {
          docId: brandId<SyncDocumentId>("doc-sub-err-1"),
          lastSyncedSeq: 0,
          lastSnapshotVersion: 0,
        },
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
    manager.addSubscription("conn-unsub", brandId<SyncDocumentId>("doc-unsub-1"));

    const message: UnsubscribeRequest = {
      type: "UnsubscribeRequest",
      correlationId: "corr-unsub",
      docId: brandId<SyncDocumentId>("doc-unsub-1"),
    };

    handleUnsubscribeRequest(message, state, manager);
    expect(manager.getSubscribers(brandId<SyncDocumentId>("doc-unsub-1")).size).toBe(0);

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
      docId: brandId<SyncDocumentId>("doc-dl-1"),
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
      docId: brandId<SyncDocumentId>("doc-dl-2"),
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
  it("returns SyncError INVALID_ENVELOPE when signature is invalid", async () => {
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(false);

    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-2",
      brandId<SyncDocumentId>("doc-ve-2"),
    );
    expect(result).not.toBeNull();
    expect(result?.code).toBe("INVALID_ENVELOPE");
  });

  it("returns null when signature is valid", async () => {
    const syncModule = await import("@pluralscape/sync");
    vi.spyOn(syncModule, "verifyEnvelopeSignature").mockReturnValue(true);

    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-3",
      brandId<SyncDocumentId>("doc-ve-3"),
    );
    expect(result).toBeNull();
  });

  it("returns SyncError INVALID_ENVELOPE when getSodium throws InvalidInputError", async () => {
    const cryptoModule = await import("@pluralscape/crypto");
    vi.spyOn(cryptoModule, "getSodium").mockImplementation(() => {
      throw new InvalidInputError("sodium not ready");
    });

    const { nonce, sig, key, ct } = brandedBytes(32, 1);
    const result = verifyEnvelopeOrError(
      { authorPublicKey: key, nonce, signature: sig, ciphertext: ct },
      "corr-ve-iie",
      brandId<SyncDocumentId>("doc-ve-iie"),
    );
    expect(result).not.toBeNull();
    expect(result?.code).toBe("INVALID_ENVELOPE");
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
      brandId<SyncDocumentId>("doc-ko-1"),
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
      brandId<SyncDocumentId>("doc-ko-2"),
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
      brandId<SyncDocumentId>("doc-ko-3"),
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
      brandId<SyncDocumentId>("doc-ko-4"),
    );
    expect(result).toBeNull();
  });
});
