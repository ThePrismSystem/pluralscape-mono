import { initSodium } from "@pluralscape/crypto";
import { EncryptedRelay } from "@pluralscape/sync";
import { brandId } from "@pluralscape/types";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Envelope signature verification is unconditional. Mock data has invalid
// signatures, so we stub verifyEnvelopeSignature at module-mock time.
vi.mock("@pluralscape/sync", async () => {
  const actual = await vi.importActual<typeof import("@pluralscape/sync")>("@pluralscape/sync");
  return {
    ...actual,
    verifyEnvelopeSignature: vi.fn(() => true),
  };
});

import {
  handleDocumentLoad,
  handleFetchChanges,
  handleFetchSnapshot,
  handleManifestRequest,
} from "../../ws/handlers.js";
import { asSyncDocId } from "../helpers/crypto-test-fixtures.js";
import { mockChangeWithoutSeq, mockSnapshot } from "../helpers/ws-handlers-fixtures.js";

import type {
  DocumentLoadRequest,
  FetchChangesRequest,
  FetchSnapshotRequest,
  ManifestRequest,
  SyncRelayService,
} from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

beforeAll(async () => {
  await initSodium();
});

describe("handleManifestRequest", () => {
  it("returns a ManifestResponse with an empty document list", async () => {
    const relay = new EncryptedRelay();
    const systemId = brandId<SystemId>(crypto.randomUUID());
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
    const systemId = brandId<SystemId>(crypto.randomUUID());
    const message: ManifestRequest = {
      type: "ManifestRequest",
      correlationId,
      systemId,
    };

    const result = await handleManifestRequest(message, relay.asService());

    expect(result.correlationId).toBe(correlationId);
  });
});

describe("handleFetchSnapshot", () => {
  it("returns the latest snapshot from the relay", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());
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
    const docId = asSyncDocId(crypto.randomUUID());

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
      docId: asSyncDocId(crypto.randomUUID()),
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
      docId: asSyncDocId("doc-1"),
      sinceSeq: 0,
    };

    await handleFetchChanges(message, mockService);

    expect(getEnvelopesSinceSpy).toHaveBeenCalledWith("doc-1", 0, 500);
  });
});

describe("handleDocumentLoad", () => {
  it("returns both snapshot and changes for the requested document", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());
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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

    await relay.submit(mockChangeWithoutSeq(docId));
    await relay.submit(mockChangeWithoutSeq(docId));

    const service = relay.asService();
    const result = await service.getEnvelopesSince(docId, 0, 10);

    expect(result.envelopes).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("returns hasMore: true when more results exist beyond the limit", async () => {
    const relay = new EncryptedRelay();
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

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
    const docId = asSyncDocId(crypto.randomUUID());

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
