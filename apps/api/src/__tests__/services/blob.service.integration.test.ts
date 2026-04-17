import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgBlobMetadataTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { QuotaExceededError } from "@pluralscape/storage";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  archiveBlob,
  confirmUpload,
  createUploadUrl,
  getBlob,
  getDownloadUrl,
  listBlobs,
} from "../../services/blob.service.js";
import {
  asDb,
  assertApiError,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";
import { createMockBlobQuota, createMockBlobStorage } from "../helpers/mock-blob-storage.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, BlobId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { blobMetadata } = schema;

/** Valid 64-char hex checksum for confirmUpload. */
const VALID_CHECKSUM = "a".repeat(64);

describe("blob.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgBlobMetadataTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(blobMetadata);
  });

  function uploadParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      purpose: "avatar",
      mimeType: "image/png",
      sizeBytes: 1024,
      encryptionTier: 1,
      ...overrides,
    };
  }

  /**
   * Helper: create + confirm a blob in one shot, returning the confirmed BlobResult.
   */
  async function createAndConfirmBlob(
    storage: ReturnType<typeof createMockBlobStorage>,
    quota: ReturnType<typeof createMockBlobQuota>,
    overrides: Record<string, unknown> = {},
  ) {
    const upload = await createUploadUrl(
      asDb(db),
      storage,
      quota,
      systemId,
      uploadParams(overrides),
      auth,
      noopAudit,
    );

    const confirmed = await confirmUpload(
      asDb(db),
      systemId,
      upload.blobId,
      { checksum: VALID_CHECKSUM },
      auth,
      noopAudit,
    );

    return { upload, confirmed };
  }

  describe("createUploadUrl", () => {
    it("returns blobId, uploadUrl, expiresAt and inserts a DB row", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const audit = spyAudit();

      const result = await createUploadUrl(
        asDb(db),
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        audit,
      );

      expect(result.blobId).toMatch(/^blob_/);
      expect(result.uploadUrl).toContain("https://mock-s3.test/upload/");
      expect(typeof result.expiresAt).toBe("number");
      expect(result.expiresAt).toBeGreaterThan(Date.now() - 60_000);

      // Verify the DB row was created
      const allRows = await db.select().from(blobMetadata);
      expect(allRows).toHaveLength(1);
      expect(allRows[0]?.id).toBe(result.blobId);
      expect(allRows[0]?.uploadedAt).toBeNull(); // still pending

      // Audit was written
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("blob.upload-requested");
    });
  });

  describe("confirmUpload", () => {
    it("marks blob as confirmed with checksum and uploadedAt", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();

      const upload = await createUploadUrl(
        asDb(db),
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await confirmUpload(
        asDb(db),
        systemId,
        upload.blobId,
        { checksum: VALID_CHECKSUM },
        auth,
        audit,
      );

      expect(result.id).toBe(upload.blobId);
      expect(result.checksum).toBe(VALID_CHECKSUM);
      expect(result.uploadedAt).toBeGreaterThan(0);
      expect(result.purpose).toBe("avatar");
      expect(result.sizeBytes).toBe(1024);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("blob.confirmed");
    });

    it("throws NOT_FOUND for non-existent blob", async () => {
      await assertApiError(
        confirmUpload(
          asDb(db),
          systemId,
          brandId<BlobId>(`blob_${crypto.randomUUID()}`),
          { checksum: VALID_CHECKSUM },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("returns confirmed result idempotently when already confirmed", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { upload } = await createAndConfirmBlob(storage, quota);

      // Confirm again — should return the existing confirmed blob
      const result = await confirmUpload(
        asDb(db),
        systemId,
        upload.blobId,
        { checksum: VALID_CHECKSUM },
        auth,
        noopAudit,
      );

      expect(result.id).toBe(upload.blobId);
      expect(result.checksum).toBe(VALID_CHECKSUM);
    });

    it("throws NOT_FOUND when thumbnailOfBlobId target does not exist", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();

      const upload = await createUploadUrl(
        asDb(db),
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      await assertApiError(
        confirmUpload(
          asDb(db),
          systemId,
          upload.blobId,
          {
            checksum: VALID_CHECKSUM,
            thumbnailOfBlobId: brandId<BlobId>(`blob_${crypto.randomUUID()}`),
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("confirms upload with thumbnailOfBlobId pointing to an existing confirmed blob", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();

      // Create the target blob first
      const { confirmed: target } = await createAndConfirmBlob(storage, quota);

      // Create the thumbnail blob (pending)
      const thumbUpload = await createUploadUrl(
        asDb(db),
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      const result = await confirmUpload(
        asDb(db),
        systemId,
        thumbUpload.blobId,
        { checksum: VALID_CHECKSUM, thumbnailOfBlobId: target.id },
        auth,
        noopAudit,
      );

      expect(result.thumbnailOfBlobId).toBe(target.id);
    });

    // Note: the toBlobResult null-checksum branch is structurally unreachable
    // through the public API: the DB CHECK constraint blob_metadata_check
    // forbids uploaded_at IS NOT NULL with checksum IS NULL, so the defensive
    // null-checksum branch in toBlobResult cannot be exercised without bypassing
    // the constraint.
  });

  describe("getBlob", () => {
    it("returns confirmed blob metadata", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const result = await getBlob(asDb(db), systemId, confirmed.id, auth);

      expect(result.id).toBe(confirmed.id);
      expect(result.systemId).toBe(systemId);
      expect(result.purpose).toBe("avatar");
      expect(result.mimeType).toBe("image/png");
      expect(result.sizeBytes).toBe(1024);
      expect(result.checksum).toBe(VALID_CHECKSUM);
      expect(result.uploadedAt).toBeGreaterThan(0);
    });

    it("throws NOT_FOUND for pending (unconfirmed) blob", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();

      const upload = await createUploadUrl(
        asDb(db),
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      await assertApiError(getBlob(asDb(db), systemId, upload.blobId, auth), "NOT_FOUND", 404);
    });
  });

  describe("getDownloadUrl", () => {
    it("returns a presigned download URL for a confirmed blob", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const result = await getDownloadUrl(asDb(db), storage, systemId, confirmed.id, auth);

      expect(result.blobId).toBe(confirmed.id);
      expect(result.downloadUrl).toContain("https://mock-s3.test/download/");
      expect(typeof result.expiresAt).toBe("number");
    });

    it("throws VALIDATION_ERROR when storage does not support presigned download URLs", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      // Override generatePresignedDownloadUrl to return unsupported
      storage.generatePresignedDownloadUrl = vi.fn().mockResolvedValue({ supported: false });

      await assertApiError(
        getDownloadUrl(asDb(db), storage, systemId, confirmed.id, auth),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("listBlobs", () => {
    it("lists confirmed blobs with pagination", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();

      const { confirmed: blob1 } = await createAndConfirmBlob(storage, quota);
      const { confirmed: blob2 } = await createAndConfirmBlob(storage, quota, {
        purpose: "member-photo",
      });

      // List all
      const result = await listBlobs(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);

      const ids = result.data.map((b) => b.id);
      expect(ids).toContain(blob1.id);
      expect(ids).toContain(blob2.id);

      // Paginate: limit 1
      const page1 = await listBlobs(asDb(db), systemId, auth, { limit: 1 });
      expect(page1.data).toHaveLength(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listBlobs(asDb(db), systemId, auth, {
        cursor: page1.data[0]?.id,
        limit: 1,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0]?.id).not.toBe(page1.data[0]?.id);
    });

    it("includes archived blobs when includeArchived is true", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      await archiveBlob(asDb(db), systemId, confirmed.id, auth, noopAudit);

      // Default list excludes archived
      const defaultList = await listBlobs(asDb(db), systemId, auth);
      expect(defaultList.data).toHaveLength(0);

      // Explicit includeArchived=true shows the archived blob
      const fullList = await listBlobs(asDb(db), systemId, auth, { includeArchived: true });
      expect(fullList.data).toHaveLength(1);
      expect(fullList.data[0]?.id).toBe(confirmed.id);
    });
  });

  describe("archiveBlob", () => {
    it("archives a confirmed blob so it no longer appears in get/list", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const audit = spyAudit();
      await archiveBlob(asDb(db), systemId, confirmed.id, auth, audit);

      // Audit recorded
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("blob.archived");

      // getBlob should now return NOT_FOUND
      await assertApiError(getBlob(asDb(db), systemId, confirmed.id, auth), "NOT_FOUND", 404);

      // listBlobs should exclude archived
      const list = await listBlobs(asDb(db), systemId, auth);
      expect(list.data).toHaveLength(0);
    });
  });

  describe("quota enforcement", () => {
    it("throws QUOTA_EXCEEDED when quota rejects", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      quota.rejectNext();

      await assertApiError(
        createUploadUrl(asDb(db), storage, quota, systemId, uploadParams(), auth, noopAudit),
        "QUOTA_EXCEEDED",
        413,
      );
    });

    it("re-throws non-QuotaExceededError from quota service", async () => {
      const storage = createMockBlobStorage();
      const unexpectedError = new Error("storage backend unavailable");
      const quota = createMockBlobQuota();
      vi.spyOn(quota, "assertQuota").mockRejectedValueOnce(unexpectedError);

      let caught: unknown;
      try {
        await createUploadUrl(asDb(db), storage, quota, systemId, uploadParams(), auth, noopAudit);
      } catch (err: unknown) {
        caught = err;
      }

      expect(caught).toBe(unexpectedError);
      expect(caught).not.toBeInstanceOf(QuotaExceededError);
    });
  });
});
