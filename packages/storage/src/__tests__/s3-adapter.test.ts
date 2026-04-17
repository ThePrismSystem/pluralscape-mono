/**
 * Unit tests for S3BlobStorageAdapter — error mapping and edge branches.
 *
 * The integration test (s3-adapter.integration.test.ts) covers happy-path
 * upload/download/delete/exists/getMetadata against a real MinIO container.
 * These unit tests cover the error and edge branches that cannot be
 * exercised against a real S3 backend without contrived failure injection:
 *   - PreconditionFailed → BlobAlreadyExistsError
 *   - download response.Body missing → BlobNotFoundError
 *   - delete swallows NoSuchKey/NotFound/404
 *   - delete propagates non-NotFound errors via mapS3Error
 *   - exists swallows NoSuchKey/NotFound/404 → false
 *   - exists propagates non-NotFound errors via mapS3Error
 *   - getMetadata returns null on NotFound, propagates other errors
 *   - getMetadata defaults missing checksum/uploadedAt metadata
 *   - presigned URL helpers propagate signing errors via mapS3Error
 *   - constructor forcePathStyle inference (endpoint vs no-endpoint)
 *   - upload size guard against maxSizeBytes
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { S3BlobStorageAdapter } from "../adapters/s3/s3-adapter.js";
import {
  BlobAlreadyExistsError,
  BlobNotFoundError,
  BlobTooLargeError,
  StorageBackendError,
} from "../errors.js";

import type { S3AdapterConfig } from "../adapters/s3/s3-config.js";
import type { StorageKey } from "@pluralscape/types";

// ── Mock @aws-sdk/s3-request-presigner ────────────────────────────────────

const mockGetSignedUrl = vi.fn();
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]): unknown => mockGetSignedUrl(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

interface MockS3Client {
  send: ReturnType<typeof vi.fn>;
}

/** Create an adapter and replace its private S3Client with a mock. */
function makeAdapter(configOverrides: Partial<S3AdapterConfig> = {}): {
  adapter: S3BlobStorageAdapter;
  client: MockS3Client;
} {
  const adapter = new S3BlobStorageAdapter({
    bucket: "test-bucket",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    credentials: { accessKeyId: "k", secretAccessKey: "s" },
    ...configOverrides,
  });
  const client: MockS3Client = { send: vi.fn() };
  // Reach into the private `client` field — tests are allowed to do this.
  // Going through `unknown` first satisfies the "no double-cast" lint rule.
  const opaque: unknown = adapter;
  (opaque as { client: MockS3Client }).client = client;
  return { adapter, client };
}

function awsError(name: string, message = name): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

const KEY = "sys/blob_test" as StorageKey;

afterEach(() => {
  vi.restoreAllMocks();
  mockGetSignedUrl.mockReset();
});

// ── upload ────────────────────────────────────────────────────────────────

describe("S3BlobStorageAdapter.upload", () => {
  it("throws BlobTooLargeError when data exceeds maxSizeBytes", async () => {
    const { adapter, client } = makeAdapter({ maxSizeBytes: 5 });
    const data = new Uint8Array(10);
    await expect(
      adapter.upload({ storageKey: KEY, data, mimeType: "image/png", checksum: "abc" }),
    ).rejects.toThrow(BlobTooLargeError);
    // size guard prevents reaching the client at all
    expect(client.send).not.toHaveBeenCalled();
  });

  it("returns metadata on successful upload (default mimeType)", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({});
    const data = new Uint8Array([1, 2, 3]);

    const result = await adapter.upload({
      storageKey: KEY,
      data,
      mimeType: null,
      checksum: "deadbeef",
    });

    expect(result.storageKey).toBe(KEY);
    expect(result.sizeBytes).toBe(3);
    expect(result.mimeType).toBeNull();
    expect(result.checksum).toBe("deadbeef");
    expect(result.uploadedAt).toBeGreaterThan(0);
  });

  it("maps PreconditionFailed → BlobAlreadyExistsError", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("PreconditionFailed"));
    await expect(
      adapter.upload({
        storageKey: KEY,
        data: new Uint8Array(1),
        mimeType: "image/png",
        checksum: "x",
      }),
    ).rejects.toThrow(BlobAlreadyExistsError);
  });

  it("re-throws BlobAlreadyExistsError untouched", async () => {
    const { adapter, client } = makeAdapter();
    const original = new BlobAlreadyExistsError(KEY);
    client.send.mockRejectedValueOnce(original);
    await expect(
      adapter.upload({
        storageKey: KEY,
        data: new Uint8Array(1),
        mimeType: null,
        checksum: "x",
      }),
    ).rejects.toBe(original);
  });

  it("propagates unknown errors via mapS3Error → StorageBackendError", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("InternalError", "boom"));
    await expect(
      adapter.upload({
        storageKey: KEY,
        data: new Uint8Array(1),
        mimeType: null,
        checksum: "x",
      }),
    ).rejects.toThrow(StorageBackendError);
  });
});

// ── download ──────────────────────────────────────────────────────────────

describe("S3BlobStorageAdapter.download", () => {
  it("returns bytes when response.Body is present", async () => {
    const { adapter, client } = makeAdapter();
    const bytes = new Uint8Array([10, 20, 30]);
    client.send.mockResolvedValueOnce({
      Body: { transformToByteArray: (): Promise<Uint8Array> => Promise.resolve(bytes) },
    });

    const result = await adapter.download(KEY);
    expect(result).toEqual(bytes);
  });

  it("throws BlobNotFoundError when response.Body is missing", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({});
    await expect(adapter.download(KEY)).rejects.toThrow(BlobNotFoundError);
  });

  it("re-throws BlobNotFoundError when client throws BlobNotFoundError", async () => {
    const { adapter, client } = makeAdapter();
    const original = new BlobNotFoundError(KEY);
    client.send.mockRejectedValueOnce(original);
    await expect(adapter.download(KEY)).rejects.toBe(original);
  });

  it("propagates non-NotFound errors via mapS3Error", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("InternalError"));
    await expect(adapter.download(KEY)).rejects.toThrow(StorageBackendError);
  });

  it("maps NoSuchKey thrown by SDK → BlobNotFoundError", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("NoSuchKey"));
    await expect(adapter.download(KEY)).rejects.toThrow(BlobNotFoundError);
  });
});

// ── delete ────────────────────────────────────────────────────────────────

describe("S3BlobStorageAdapter.delete", () => {
  it("succeeds normally", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({});
    await expect(adapter.delete(KEY)).resolves.toBeUndefined();
  });

  it.each(["NoSuchKey", "NotFound", "404"])(
    "swallows %s errors (idempotent delete)",
    async (errName) => {
      const { adapter, client } = makeAdapter();
      client.send.mockRejectedValueOnce(awsError(errName));
      await expect(adapter.delete(KEY)).resolves.toBeUndefined();
    },
  );

  it("propagates non-NotFound errors via mapS3Error", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("AccessDenied"));
    await expect(adapter.delete(KEY)).rejects.toThrow(StorageBackendError);
  });

  it("wraps non-Error rejections in StorageBackendError via mapS3Error", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce("string-rejection");
    await expect(adapter.delete(KEY)).rejects.toThrow(StorageBackendError);
  });
});

// ── exists ────────────────────────────────────────────────────────────────

describe("S3BlobStorageAdapter.exists", () => {
  it("returns true when HEAD succeeds", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({});
    expect(await adapter.exists(KEY)).toBe(true);
  });

  it.each(["NoSuchKey", "NotFound", "404"])(
    "returns false when HEAD throws %s",
    async (errName) => {
      const { adapter, client } = makeAdapter();
      client.send.mockRejectedValueOnce(awsError(errName));
      expect(await adapter.exists(KEY)).toBe(false);
    },
  );

  it("propagates non-NotFound errors via mapS3Error", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("AccessDenied"));
    await expect(adapter.exists(KEY)).rejects.toThrow(StorageBackendError);
  });
});

// ── getMetadata ───────────────────────────────────────────────────────────

describe("S3BlobStorageAdapter.getMetadata", () => {
  it("returns metadata with full headers", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({
      ContentLength: 42,
      ContentType: "image/png",
      Metadata: { checksum: "deadbeef", uploadedat: "1700000000000" },
    });
    const meta = await adapter.getMetadata(KEY);
    expect(meta).toEqual({
      storageKey: KEY,
      sizeBytes: 42,
      mimeType: "image/png",
      checksum: "deadbeef",
      uploadedAt: 1700000000000,
    });
  });

  it("normalizes application/octet-stream → null mimeType", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({
      ContentLength: 1,
      ContentType: "application/octet-stream",
      Metadata: { checksum: "c", uploadedat: "1" },
    });
    const meta = await adapter.getMetadata(KEY);
    expect(meta?.mimeType).toBeNull();
  });

  it("defaults missing checksum/uploadedAt/contentType/contentLength", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockResolvedValueOnce({});
    const meta = await adapter.getMetadata(KEY);
    expect(meta?.checksum).toBe("");
    expect(meta?.uploadedAt).toBe(0);
    expect(meta?.sizeBytes).toBe(0);
    expect(meta?.mimeType).toBeNull();
  });

  it("returns null when SDK throws NoSuchKey", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("NoSuchKey"));
    expect(await adapter.getMetadata(KEY)).toBeNull();
  });

  it("returns null when SDK throws NotFound", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("NotFound"));
    expect(await adapter.getMetadata(KEY)).toBeNull();
  });

  it("returns null when SDK throws 404", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("404"));
    expect(await adapter.getMetadata(KEY)).toBeNull();
  });

  it("propagates non-NotFound errors via mapS3Error", async () => {
    const { adapter, client } = makeAdapter();
    client.send.mockRejectedValueOnce(awsError("InternalError"));
    await expect(adapter.getMetadata(KEY)).rejects.toThrow(StorageBackendError);
  });
});

// ── presigned URL helpers ─────────────────────────────────────────────────

describe("S3BlobStorageAdapter.generatePresignedUploadUrl", () => {
  it("returns supported url + expiresAt on success (no fields — PUT-based)", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/upload?X-Amz-Signature=sig");
    const result = await adapter.generatePresignedUploadUrl({
      storageKey: KEY,
      mimeType: "image/png",
      sizeBytes: 1024,
    });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.url).toBe("https://signed.example/upload?X-Amz-Signature=sig");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      // PUT-based presigned URLs carry everything in the URL itself — no
      // multipart `fields` payload for the client to forward.
      expect(result.fields).toBeUndefined();
    }
  });

  it("signs If-None-Match so S3 enforces write-once on the presigned URL", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/upload");
    await adapter.generatePresignedUploadUrl({
      storageKey: KEY,
      mimeType: "image/png",
      sizeBytes: 2048,
    });
    expect(mockGetSignedUrl).toHaveBeenCalledOnce();
    const callArgs = mockGetSignedUrl.mock.calls[0] as unknown[];
    const command = callArgs[1] as { input: { IfNoneMatch?: string } };
    expect(command.input.IfNoneMatch).toBe("*");
    // The `if-none-match` header must be in the signable set, otherwise S3
    // will accept a request that omits it and silently overwrite the blob.
    const signOptions = callArgs[2] as { signableHeaders?: Set<string> };
    expect(signOptions.signableHeaders).toBeInstanceOf(Set);
    expect(signOptions.signableHeaders?.has("if-none-match")).toBe(true);
  });

  it("uses configured presignedUploadExpiryMs default when no override", async () => {
    const { adapter } = makeAdapter({ presignedUploadExpiryMs: 60_000 });
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/upload");
    const before = Date.now();
    const result = await adapter.generatePresignedUploadUrl({
      storageKey: KEY,
      mimeType: null,
      sizeBytes: 100,
    });
    if (result.supported) {
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 60_000 - 1_000);
      expect(result.expiresAt).toBeLessThanOrEqual(before + 60_000 + 5_000);
    }
  });

  it("propagates errors via mapS3Error", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockRejectedValueOnce(awsError("AccessDenied"));
    await expect(
      adapter.generatePresignedUploadUrl({
        storageKey: KEY,
        mimeType: null,
        sizeBytes: 1,
      }),
    ).rejects.toThrow(StorageBackendError);
  });
});

describe("S3BlobStorageAdapter.generatePresignedDownloadUrl", () => {
  it("returns supported url + expiresAt on success", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/download");
    const result = await adapter.generatePresignedDownloadUrl({ storageKey: KEY });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.url).toBe("https://signed.example/download");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    }
  });

  it("respects per-call expiresInMs override", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/download");
    const before = Date.now();
    const result = await adapter.generatePresignedDownloadUrl({
      storageKey: KEY,
      expiresInMs: 30_000,
    });
    if (result.supported) {
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 30_000 - 1_000);
      expect(result.expiresAt).toBeLessThanOrEqual(before + 30_000 + 5_000);
    }
  });

  it("propagates errors via mapS3Error", async () => {
    const { adapter } = makeAdapter();
    mockGetSignedUrl.mockRejectedValueOnce(awsError("AccessDenied"));
    await expect(adapter.generatePresignedDownloadUrl({ storageKey: KEY })).rejects.toThrow(
      StorageBackendError,
    );
  });
});

// ── constructor branches ──────────────────────────────────────────────────

describe("S3BlobStorageAdapter constructor", () => {
  it("constructs without endpoint (forcePathStyle defaults to false)", () => {
    const adapter = new S3BlobStorageAdapter({
      bucket: "b",
      region: "us-east-1",
    });
    expect(adapter).toBeDefined();
    expect(adapter.supportsPresignedUrls).toBe(true);
  });

  it("constructs with explicit forcePathStyle override", () => {
    const adapter = new S3BlobStorageAdapter({
      bucket: "b",
      region: "us-east-1",
      endpoint: "http://localhost:9000",
      forcePathStyle: false,
    });
    expect(adapter).toBeDefined();
  });

  it("uses configured presignedDownloadExpiryMs default when omitted", async () => {
    const { adapter } = makeAdapter({ presignedDownloadExpiryMs: 90_000 });
    mockGetSignedUrl.mockResolvedValueOnce("https://signed.example/d");
    const before = Date.now();
    const result = await adapter.generatePresignedDownloadUrl({ storageKey: KEY });
    if (result.supported) {
      expect(result.expiresAt).toBeGreaterThanOrEqual(before + 90_000 - 1_000);
      expect(result.expiresAt).toBeLessThanOrEqual(before + 90_000 + 5_000);
    }
  });
});
