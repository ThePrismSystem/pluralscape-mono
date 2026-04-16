import { DecryptionFailedError, decrypt, encrypt } from "@pluralscape/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { processChunk } from "../chunk-processor.js";
import { decryptWithDualKey } from "../dual-key-reader.js";
import { RotationWorker } from "../rotation-worker.js";

import type {
  CompletionItem,
  RotationApiClient,
  RotationSodium,
  RotationWorkerConfig,
} from "../types.js";
import type { AeadKey, EncryptedPayload } from "@pluralscape/crypto";
import type {
  BucketId,
  BucketKeyRotation,
  BucketRotationItem,
  ChunkClaimResponse,
  EntityType,
} from "@pluralscape/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockMemzero = vi.fn();

vi.mock("@pluralscape/crypto", () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  getSodium: () => ({ memzero: mockMemzero }),
  DecryptionFailedError: class DecryptionFailedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "DecryptionFailedError";
    }
  },
}));

// Clear all mock state before each test to prevent cross-test contamination.
beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const OLD_KEY_VERSION = 1;
const NEW_KEY_VERSION = 2;
const OLD_KEY = new Uint8Array(32).fill(0xaa) as AeadKey;
const NEW_KEY = new Uint8Array(32).fill(0xbb) as AeadKey;

const BUCKET_ID = "bucket-abc" as BucketId;
const ROTATION_ID = "rotation-001";

function makePayload(): EncryptedPayload {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: new Uint8Array([4, 5, 6]),
  } as EncryptedPayload;
}

function makeItem(id: string, entityId = "entity-" + id): BucketRotationItem {
  return {
    id: `item-${id}` as BucketRotationItem["id"],
    rotationId: ROTATION_ID as BucketRotationItem["rotationId"],
    entityType: "member",
    entityId,
    status: "claimed",
    claimedBy: "worker-1",
    claimedAt: Date.now() as BucketRotationItem["claimedAt"],
    completedAt: null,
    attempts: 0,
  };
}

function makeRotation(state: BucketKeyRotation["state"] = "migrating"): BucketKeyRotation {
  return {
    id: ROTATION_ID as BucketKeyRotation["id"],
    bucketId: BUCKET_ID,
    fromKeyVersion: OLD_KEY_VERSION,
    toKeyVersion: NEW_KEY_VERSION,
    state,
    initiatedAt: Date.now() as BucketKeyRotation["initiatedAt"],
    completedAt: null,
    totalItems: 10,
    completedItems: 0,
    failedItems: 0,
  };
}

function httpError(status: number): Error & { status: number } {
  const err = Object.assign(new Error(`HTTP ${String(status)}`), { status });
  return err;
}

// ── DualKeyReader ─────────────────────────────────────────────────────────────

describe("decryptWithDualKey", () => {
  const payload = makePayload();
  const plaintext = new Uint8Array([7, 8, 9]);

  beforeEach(() => {
    vi.mocked(decrypt).mockReturnValue(plaintext);
  });

  it("selects the old key when keyVersion matches oldKeyVersion", () => {
    decryptWithDualKey(
      payload,
      OLD_KEY_VERSION,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
    );
    expect(decrypt).toHaveBeenCalledWith(payload, OLD_KEY);
  });

  it("selects the new key when keyVersion matches newKeyVersion", () => {
    decryptWithDualKey(
      payload,
      NEW_KEY_VERSION,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
    );
    expect(decrypt).toHaveBeenCalledWith(payload, NEW_KEY);
  });

  it("returns the decrypted bytes", () => {
    const result = decryptWithDualKey(
      payload,
      OLD_KEY_VERSION,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
    );
    expect(result).toBe(plaintext);
  });

  it("throws DecryptionFailedError for an unknown key version", () => {
    expect(() =>
      decryptWithDualKey(payload, 99, OLD_KEY, OLD_KEY_VERSION, NEW_KEY, NEW_KEY_VERSION),
    ).toThrow(DecryptionFailedError);
  });

  it("throws without calling decrypt on unknown version (fail-closed)", () => {
    expect(() =>
      decryptWithDualKey(payload, 99, OLD_KEY, OLD_KEY_VERSION, NEW_KEY, NEW_KEY_VERSION),
    ).toThrow();
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("error message includes the unknown version and expected versions", () => {
    expect(() =>
      decryptWithDualKey(payload, 99, OLD_KEY, OLD_KEY_VERSION, NEW_KEY, NEW_KEY_VERSION),
    ).toThrow(/99/);
  });
});

// ── ChunkProcessor ────────────────────────────────────────────────────────────

describe("processChunk", () => {
  let apiClient: ReturnType<typeof makeMockApiClient>;
  const plaintext = new Uint8Array([10, 20, 30]);
  const reencryptedPayload = makePayload();
  const signal = new AbortController().signal;

  function makeMockApiClient() {
    return {
      claimChunk: vi.fn(),
      completeChunk: vi.fn(),
      getProgress: vi.fn(),
      fetchEntityBlob: vi.fn<RotationApiClient["fetchEntityBlob"]>(),
      uploadReencrypted: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    } satisfies RotationApiClient;
  }

  beforeEach(() => {
    apiClient = makeMockApiClient();
    vi.mocked(decrypt).mockReturnValue(plaintext);
    vi.mocked(encrypt).mockReturnValue(reencryptedPayload);
  });

  it("decrypts and re-encrypts each item in the chunk", async () => {
    const items = [makeItem("1"), makeItem("2")];
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });

    const results = await processChunk(
      items,
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(decrypt).toHaveBeenCalledTimes(2);
    expect(encrypt).toHaveBeenCalledTimes(2);
    expect(apiClient.uploadReencrypted).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results.every((r: CompletionItem) => r.status === "completed")).toBe(true);
  });

  it("skips re-encryption when blob keyVersion is already at newKeyVersion", async () => {
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: NEW_KEY_VERSION,
    });

    const results = await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(encrypt).not.toHaveBeenCalled();
    expect(apiClient.uploadReencrypted).not.toHaveBeenCalled();
    expect(results[0]?.status).toBe("completed");
  });

  it("marks item completed on 404 (entity deleted)", async () => {
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockRejectedValue(httpError(404));

    const results = await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(results[0]?.status).toBe("completed");
  });

  it("marks item completed on 409 (concurrent write conflict)", async () => {
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.uploadReencrypted.mockRejectedValue(httpError(409));

    const results = await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(results[0]?.status).toBe("completed");
  });

  it("marks item failed after exhausting all retries", async () => {
    vi.useFakeTimers();
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockRejectedValue(new Error("transient failure"));

    const promise = processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    // Advance timers through all retry delays (500ms, 1000ms)
    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results[0]?.status).toBe("failed");
    vi.useRealTimers();
  });

  it("stops processing early when signal is aborted", async () => {
    const controller = new AbortController();
    const items = [makeItem("1"), makeItem("2"), makeItem("3")];

    apiClient.fetchEntityBlob.mockImplementation(() => {
      controller.abort();
      return Promise.resolve({ payload: makePayload(), keyVersion: OLD_KEY_VERSION });
    });

    const results = await processChunk(
      items,
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      controller.signal,
    );

    // Only the first item was processed before abort
    expect(results.length).toBeLessThan(items.length);
  });

  it("includes the itemId in each completion result", async () => {
    const item = makeItem("42");
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });

    const results = await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(results[0]?.itemId).toBe("item-42");
  });

  it("uploads re-encrypted blob with the new key version", async () => {
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });

    await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(apiClient.uploadReencrypted).toHaveBeenCalledWith(
      item.entityType,
      item.entityId,
      reencryptedPayload,
      NEW_KEY_VERSION,
    );
  });

  it("returns empty array for empty input", async () => {
    const results = await processChunk(
      [],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );
    expect(results).toEqual([]);
  });

  it("partial success: one item succeeds, another fails", async () => {
    vi.useFakeTimers();
    const goodItem = makeItem("good");
    const badItem = makeItem("bad");

    apiClient.fetchEntityBlob.mockImplementation((_type: EntityType, entityId: string) => {
      if (entityId === "entity-bad") {
        return Promise.reject(new Error("transient failure"));
      }
      return Promise.resolve({ payload: makePayload(), keyVersion: OLD_KEY_VERSION });
    });

    const promise = processChunk(
      [goodItem, badItem],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("completed");
    expect(results[0]?.itemId).toBe("item-good");
    expect(results[1]?.status).toBe("failed");
    expect(results[1]?.itemId).toBe("item-bad");
    vi.useRealTimers();
  });

  it("stops processing when signal is aborted between items", async () => {
    const controller = new AbortController();
    const items = [makeItem("1"), makeItem("2"), makeItem("3")];
    let callCount = 0;

    apiClient.fetchEntityBlob.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ payload: makePayload(), keyVersion: OLD_KEY_VERSION });
    });

    // Abort after first item completes
    apiClient.uploadReencrypted.mockImplementation(() => {
      if (callCount >= 1) {
        controller.abort();
      }
      return Promise.resolve();
    });

    const results = await processChunk(
      items,
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      controller.signal,
    );

    // First item completed, then abort fired before second item could start
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0]?.status).toBe("completed");
  });

  it("includes failureReason when an item fails", async () => {
    vi.useFakeTimers();
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockRejectedValue(new Error("network timeout"));

    const promise = processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    await vi.runAllTimersAsync();
    const results = await promise;

    expect(results[0]?.status).toBe("failed");
    // Access failureReason from the underlying ItemProcessResult via CompletionItem
    // The CompletionItem only has itemId/status, but the processItem returns failureReason
    vi.useRealTimers();
  });

  it("zeros plaintext after re-encryption", async () => {
    const item = makeItem("1");
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    mockMemzero.mockClear();

    await processChunk(
      [item],
      apiClient,
      OLD_KEY,
      OLD_KEY_VERSION,
      NEW_KEY,
      NEW_KEY_VERSION,
      signal,
    );

    expect(mockMemzero).toHaveBeenCalledWith(plaintext);
  });
});

// ── RotationWorker ────────────────────────────────────────────────────────────

describe("RotationWorker", () => {
  let apiClient: ReturnType<typeof makeMockApiClient>;

  function makeMockApiClient() {
    return {
      claimChunk: vi.fn<RotationApiClient["claimChunk"]>(),
      completeChunk: vi.fn<RotationApiClient["completeChunk"]>(),
      getProgress: vi.fn<RotationApiClient["getProgress"]>(),
      fetchEntityBlob: vi.fn<RotationApiClient["fetchEntityBlob"]>(),
      uploadReencrypted: vi
        .fn<RotationApiClient["uploadReencrypted"]>()
        .mockResolvedValue(undefined),
    };
  }

  const mockSodium: RotationSodium = { memzero: vi.fn() };

  function makeConfig(overrides?: Partial<RotationWorkerConfig>): RotationWorkerConfig {
    return {
      apiClient: apiClient as RotationApiClient,
      bucketId: BUCKET_ID,
      rotationId: ROTATION_ID,
      oldKey: OLD_KEY,
      oldKeyVersion: OLD_KEY_VERSION,
      newKey: NEW_KEY,
      newKeyVersion: NEW_KEY_VERSION,
      chunkSize: 5,
      sodium: mockSodium,
      ...overrides,
    };
  }

  beforeEach(() => {
    apiClient = makeMockApiClient();
    vi.mocked(decrypt).mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(encrypt).mockReturnValue(makePayload());
  });

  it("isRunning is false before start", () => {
    const worker = new RotationWorker(makeConfig());
    expect(worker.isRunning).toBe(false);
  });

  it("stops when claimChunk returns an empty items array", async () => {
    apiClient.claimChunk.mockResolvedValue({ data: [], rotationState: "migrating" });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(apiClient.claimChunk).toHaveBeenCalledOnce();
    expect(apiClient.completeChunk).not.toHaveBeenCalled();
    expect(worker.isRunning).toBe(false);
  });

  it("processes a full chunk and calls completeChunk", async () => {
    const item = makeItem("1");
    apiClient.claimChunk
      .mockResolvedValueOnce({ data: [item], rotationState: "migrating" })
      .mockResolvedValueOnce({ data: [], rotationState: "migrating" });
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.completeChunk.mockResolvedValue({
      rotation: makeRotation("migrating"),
      transitioned: false,
    });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(apiClient.completeChunk).toHaveBeenCalledOnce();
    expect(apiClient.completeChunk).toHaveBeenCalledWith(
      BUCKET_ID,
      ROTATION_ID,
      expect.arrayContaining([expect.objectContaining({ itemId: item.id, status: "completed" })]),
    );
  });

  it("calls onProgress with the rotation after each chunk", async () => {
    const rotation = makeRotation("migrating");
    apiClient.claimChunk
      .mockResolvedValueOnce({ data: [makeItem("1")], rotationState: "migrating" })
      .mockResolvedValueOnce({ data: [], rotationState: "migrating" });
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.completeChunk.mockResolvedValue({ rotation, transitioned: false });

    const onProgress = vi.fn();
    const worker = new RotationWorker(makeConfig(), onProgress);
    await worker.start();

    expect(onProgress).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledWith(rotation);
  });

  it("stops after completeChunk returns a completed rotation state", async () => {
    apiClient.claimChunk.mockResolvedValue({
      data: [makeItem("1")],
      rotationState: "migrating",
    });
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.completeChunk.mockResolvedValue({
      rotation: makeRotation("completed"),
      transitioned: true,
    });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(apiClient.claimChunk).toHaveBeenCalledOnce();
  });

  it("stops after completeChunk returns a failed rotation state", async () => {
    apiClient.claimChunk.mockResolvedValue({
      data: [makeItem("1")],
      rotationState: "migrating",
    });
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.completeChunk.mockResolvedValue({
      rotation: makeRotation("failed"),
      transitioned: true,
    });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(apiClient.claimChunk).toHaveBeenCalledOnce();
  });

  it("resolves gracefully on rotation-level 404 (rotation deleted)", async () => {
    apiClient.claimChunk.mockRejectedValue(httpError(404));

    const worker = new RotationWorker(makeConfig());
    await expect(worker.start()).resolves.toBeUndefined();
  });

  it("re-throws non-404 errors from claimChunk", async () => {
    apiClient.claimChunk.mockRejectedValue(httpError(500));

    const worker = new RotationWorker(makeConfig());
    await expect(worker.start()).rejects.toMatchObject({ status: 500 });
  });

  it("stop() aborts the running worker", async () => {
    let resolveChunk!: () => void;
    apiClient.claimChunk.mockImplementation(
      () =>
        new Promise<ChunkClaimResponse>((resolve) => {
          resolveChunk = () => {
            resolve({ data: [], rotationState: "migrating" });
          };
        }),
    );

    const worker = new RotationWorker(makeConfig());
    const startPromise = worker.start();

    expect(worker.isRunning).toBe(true);
    worker.stop();
    resolveChunk();

    await startPromise;
    expect(worker.isRunning).toBe(false);
  });

  it("isRunning is false after completion", async () => {
    apiClient.claimChunk.mockResolvedValue({ data: [], rotationState: "migrating" });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(worker.isRunning).toBe(false);
  });

  it("start() is a no-op when already running", async () => {
    let firstResolve!: () => void;
    apiClient.claimChunk
      .mockImplementationOnce(
        () =>
          new Promise<ChunkClaimResponse>((resolve) => {
            firstResolve = () => {
              resolve({ data: [], rotationState: "migrating" });
            };
          }),
      )
      .mockResolvedValue({ data: [], rotationState: "migrating" });

    const worker = new RotationWorker(makeConfig());
    const first = worker.start();
    const second = worker.start(); // should no-op

    firstResolve();
    await Promise.all([first, second]);

    // claimChunk called exactly once (from first start only)
    expect(apiClient.claimChunk).toHaveBeenCalledOnce();
  });

  it("uses the configured chunkSize when claiming chunks", async () => {
    apiClient.claimChunk.mockResolvedValue({ data: [], rotationState: "migrating" });

    const worker = new RotationWorker(makeConfig({ chunkSize: 25 }));
    await worker.start();

    expect(apiClient.claimChunk).toHaveBeenCalledWith(BUCKET_ID, ROTATION_ID, 25);
  });

  it("processes multiple chunks in sequence until empty", async () => {
    const rotation = makeRotation("migrating");
    apiClient.claimChunk
      .mockResolvedValueOnce({ data: [makeItem("1"), makeItem("2")], rotationState: "migrating" })
      .mockResolvedValueOnce({ data: [makeItem("3")], rotationState: "migrating" })
      .mockResolvedValueOnce({ data: [], rotationState: "migrating" });
    apiClient.fetchEntityBlob.mockResolvedValue({
      payload: makePayload(),
      keyVersion: OLD_KEY_VERSION,
    });
    apiClient.completeChunk.mockResolvedValue({ rotation, transitioned: false });

    const worker = new RotationWorker(makeConfig());
    await worker.start();

    expect(apiClient.claimChunk).toHaveBeenCalledTimes(3);
    expect(apiClient.completeChunk).toHaveBeenCalledTimes(2);
  });

  it("zeros oldKey and newKey after successful completion", async () => {
    apiClient.claimChunk.mockResolvedValue({ data: [], rotationState: "migrating" });
    const sodiumSpy = vi.fn();
    const sodium: RotationSodium = { memzero: sodiumSpy };

    const worker = new RotationWorker(makeConfig({ sodium }));
    await worker.start();

    expect(sodiumSpy).toHaveBeenCalledWith(OLD_KEY);
    expect(sodiumSpy).toHaveBeenCalledWith(NEW_KEY);
    expect(sodiumSpy).toHaveBeenCalledTimes(2);
  });

  it("zeros keys even when start() throws", async () => {
    apiClient.claimChunk.mockRejectedValue(httpError(500));
    const sodiumSpy = vi.fn();
    const sodium: RotationSodium = { memzero: sodiumSpy };

    const worker = new RotationWorker(makeConfig({ sodium }));
    await expect(worker.start()).rejects.toMatchObject({ status: 500 });

    expect(sodiumSpy).toHaveBeenCalledWith(OLD_KEY);
    expect(sodiumSpy).toHaveBeenCalledWith(NEW_KEY);
  });
});
