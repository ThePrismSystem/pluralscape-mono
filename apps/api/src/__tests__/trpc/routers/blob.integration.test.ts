import { beforeAll, describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

// Blob-specific storage mock. The blob router reaches the S3 adapter via the
// module-level `getStorageAdapter()` / `getQuotaService()` in `lib/storage.ts`
// rather than through TRPCContext, so we replace the module wholesale with
// the in-memory mock shared with the service-level integration tests. The
// quota is wrapped around a lightweight usage-query stub so upload quota is
// effectively unlimited during these tests.
//
// `mockAdapterRef` is hoisted via `vi.hoisted()` so it's initialised before
// the `vi.mock()` factory runs (factories execute before module-level
// statements). Tests reference the same adapter instance via the ref object,
// avoiding a `getStorageAdapter() as ReturnType<typeof createMockBlobStorage>`
// downcast since the production return type doesn't expose the in-memory
// `.blobs` Map.
const mocks = vi.hoisted(() => ({
  adapterRef: {
    current: null as ReturnType<
      typeof import("../../helpers/mock-blob-storage.js").createMockBlobStorage
    > | null,
  },
}));
vi.mock("../../../lib/storage.js", async (): Promise<typeof import("../../../lib/storage.js")> => {
  const { createMockBlobQuota, createMockBlobStorage } =
    await import("../../helpers/mock-blob-storage.js");
  const adapter = createMockBlobStorage();
  mocks.adapterRef.current = adapter;
  const quota = createMockBlobQuota();
  return {
    getStorageAdapter: () => adapter,
    getQuotaService: () => quota,
    initStorageAdapter: () => {},
    setStorageAdapterForTesting: () => {},
    _resetStorageAdapterForTesting: () => {},
  };
});

import { confirmUpload, createUploadUrl } from "../../../services/blob.service.js";
import { blobRouter } from "../../../trpc/routers/blob.js";
import { noopAudit } from "../../helpers/integration-setup.js";
import { createMockBlobQuota, createMockBlobStorage } from "../../helpers/mock-blob-storage.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { BlobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Valid upload payload for an avatar purpose. `avatar` is on the MIME allowlist
 * for `image/png`; any purpose+mimeType pair must match `ALLOWED_MIME_TYPES`
 * in @pluralscape/validation/blob or the Zod superRefine will reject the input
 * with VALIDATION_ERROR before the router ever runs.
 */
const TEST_BLOB_PURPOSE = "avatar" as const;
const TEST_BLOB_MIME = "image/png";
const TEST_BLOB_SIZE_BYTES = 1024;
const TEST_BLOB_ENCRYPTION_TIER = 1 as const;

/**
 * 64-char hex digest — the exact length enforced by ConfirmUploadBodySchema.
 * Any other length fails Zod validation with VALIDATION_ERROR.
 */
const VALID_CHECKSUM_HEX = "a".repeat(64);

/** Default list limit used by the router; matches MAX_BLOB_LIMIT behaviour. */
const TEST_LIST_LIMIT = 10;

/**
 * The storage adapter argument is the mock returned by `getStorageAdapter()` —
 * passed explicitly so tests can assert against the same adapter instance the
 * router uses.
 */
async function seedBlob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  storageAdapter: ReturnType<typeof createMockBlobStorage>,
): Promise<BlobId> {
  // `createMockBlobQuota` returns a real BlobQuotaService backed by a fake
  // usage query that always reports zero usage — effectively unlimited quota
  // for the seeding path. The router under test still exercises the real
  // mocked `getQuotaService()` value separately.
  const quota = createMockBlobQuota();
  const upload = await createUploadUrl(
    db,
    storageAdapter,
    quota,
    systemId,
    {
      purpose: TEST_BLOB_PURPOSE,
      mimeType: TEST_BLOB_MIME,
      sizeBytes: TEST_BLOB_SIZE_BYTES,
      encryptionTier: TEST_BLOB_ENCRYPTION_TIER,
    },
    auth,
    noopAudit,
  );
  const confirmed = await confirmUpload(
    db,
    systemId,
    upload.blobId,
    { checksum: VALID_CHECKSUM_HEX },
    auth,
    noopAudit,
  );
  return confirmed.id;
}

describe("blob router integration", () => {
  /**
   * Handle to the mocked storage adapter returned by `getStorageAdapter()` —
   * captured here so `seedBlob` shares state with the router under test.
   * Hydrated in `beforeAll` from the hoisted `mocks.adapterRef` ref that the
   * `vi.mock()` factory populated when the mocked module was first loaded.
   */
  let storageAdapter: ReturnType<typeof createMockBlobStorage>;

  const fixture = setupRouterFixture(
    { blob: blobRouter },
    {
      extraAfterEach: () => {
        // Mock storage state persists across tests because the adapter
        // instance is captured in the vi.mock() factory closure; clear it
        // here so seeded blobs from one test don't leak into another's
        // download/list assertions.
        storageAdapter.blobs.clear();
      },
    },
  );

  beforeAll(() => {
    if (!mocks.adapterRef.current) {
      throw new Error("storage mock adapter not initialized by vi.mock factory");
    }
    storageAdapter = mocks.adapterRef.current;
  });

  describe("blob.createUploadUrl", () => {
    it("returns a presigned upload URL and inserts a pending blob row", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.blob.createUploadUrl({
        systemId: primary.systemId,
        purpose: TEST_BLOB_PURPOSE,
        mimeType: TEST_BLOB_MIME,
        sizeBytes: TEST_BLOB_SIZE_BYTES,
        encryptionTier: TEST_BLOB_ENCRYPTION_TIER,
      });
      expect(result.blobId).toMatch(/^blob_/);
      expect(result.uploadUrl).toContain("https://mock-s3.test/upload/");
      expect(typeof result.expiresAt).toBe("number");
    });
  });

  describe("blob.confirmUpload", () => {
    it("confirms a pending upload and returns the blob metadata", async () => {
      const primary = fixture.getPrimary();
      // Use createUploadUrl (not seedBlob) to obtain a *pending* blobId —
      // seedBlob already confirms, and confirmUpload on an already-confirmed
      // blob is idempotent but doesn't exercise the pending→confirmed path.
      const caller = fixture.getCaller(primary.auth);
      const upload = await caller.blob.createUploadUrl({
        systemId: primary.systemId,
        purpose: TEST_BLOB_PURPOSE,
        mimeType: TEST_BLOB_MIME,
        sizeBytes: TEST_BLOB_SIZE_BYTES,
        encryptionTier: TEST_BLOB_ENCRYPTION_TIER,
      });
      const result = await caller.blob.confirmUpload({
        systemId: primary.systemId,
        blobId: upload.blobId,
        checksum: VALID_CHECKSUM_HEX,
      });
      expect(result.id).toBe(upload.blobId);
      expect(result.systemId).toBe(primary.systemId);
    });
  });

  describe("blob.get", () => {
    it("returns a confirmed blob by id", async () => {
      const primary = fixture.getPrimary();
      const blobId = await seedBlob(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
        storageAdapter,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.blob.get({
        systemId: primary.systemId,
        blobId,
      });
      expect(result.id).toBe(blobId);
    });
  });

  describe("blob.list", () => {
    it("returns confirmed, non-archived blobs of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedBlob(db, primary.systemId, primary.auth, storageAdapter);
      await seedBlob(db, primary.systemId, primary.auth, storageAdapter);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.blob.list({
        systemId: primary.systemId,
        limit: TEST_LIST_LIMIT,
        includeArchived: false,
      });
      expect(result.data.length).toBe(2);
    });
  });

  describe("blob.getDownloadUrl", () => {
    it("returns a presigned download URL for a confirmed blob", async () => {
      const primary = fixture.getPrimary();
      const blobId = await seedBlob(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
        storageAdapter,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.blob.getDownloadUrl({
        systemId: primary.systemId,
        blobId,
      });
      expect(result.blobId).toBe(blobId);
      expect(result.downloadUrl).toContain("https://mock-s3.test/download/");
      expect(typeof result.expiresAt).toBe("number");
    });
  });

  describe("blob.delete", () => {
    it("archives a confirmed blob", async () => {
      const primary = fixture.getPrimary();
      const blobId = await seedBlob(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
        storageAdapter,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.blob.delete({
        systemId: primary.systemId,
        blobId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(
        caller.blob.list({
          systemId: primary.systemId,
          limit: TEST_LIST_LIMIT,
          includeArchived: false,
        }),
      );
    });
  });

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's blob", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherBlobId = await seedBlob(
        fixture.getCtx().db,
        other.systemId,
        other.auth,
        storageAdapter,
      );
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.blob.get({
          systemId: other.systemId,
          blobId: otherBlobId,
        }),
      );
    });
  });
});
