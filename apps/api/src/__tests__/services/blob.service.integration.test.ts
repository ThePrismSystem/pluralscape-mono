import { PGlite } from "@electric-sql/pglite";
import { accounts, blobMetadata, systems } from "@pluralscape/db/pg";
import {
  createPgBlobMetadataTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveBlob,
  confirmUpload,
  createUploadUrl,
  getBlob,
  getDownloadUrl,
  listBlobs,
} from "../../services/blob.service.js";
import { assertApiError, makeAuth, noopAudit, spyAudit } from "../helpers/integration-setup.js";
import { createMockBlobQuota, createMockBlobStorage } from "../helpers/mock-blob-storage.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, BlobId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, blobMetadata };

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

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
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
      db as never,
      storage,
      quota,
      systemId,
      uploadParams(overrides),
      auth,
      noopAudit,
    );

    const confirmed = await confirmUpload(
      db as never,
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
        db as never,
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
        db as never,
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await confirmUpload(
        db as never,
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
          db as never,
          systemId,
          `blob_${crypto.randomUUID()}` as BlobId,
          { checksum: VALID_CHECKSUM },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("getBlob", () => {
    it("returns confirmed blob metadata", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const result = await getBlob(db as never, systemId, confirmed.id, auth);

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
        db as never,
        storage,
        quota,
        systemId,
        uploadParams(),
        auth,
        noopAudit,
      );

      await assertApiError(getBlob(db as never, systemId, upload.blobId, auth), "NOT_FOUND", 404);
    });
  });

  describe("getDownloadUrl", () => {
    it("returns a presigned download URL for a confirmed blob", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const result = await getDownloadUrl(db as never, storage, systemId, confirmed.id, auth);

      expect(result.blobId).toBe(confirmed.id);
      expect(result.downloadUrl).toContain("https://mock-s3.test/download/");
      expect(typeof result.expiresAt).toBe("number");
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
      const result = await listBlobs(db as never, systemId, auth);
      expect(result.items).toHaveLength(2);

      const ids = result.items.map((b) => b.id);
      expect(ids).toContain(blob1.id);
      expect(ids).toContain(blob2.id);

      // Paginate: limit 1
      const page1 = await listBlobs(db as never, systemId, auth, { limit: 1 });
      expect(page1.items).toHaveLength(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listBlobs(db as never, systemId, auth, {
        cursor: page1.items[0]?.id,
        limit: 1,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });
  });

  describe("archiveBlob", () => {
    it("archives a confirmed blob so it no longer appears in get/list", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      const { confirmed } = await createAndConfirmBlob(storage, quota);

      const audit = spyAudit();
      await archiveBlob(db as never, systemId, confirmed.id, auth, audit);

      // Audit recorded
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("blob.archived");

      // getBlob should now return NOT_FOUND
      await assertApiError(getBlob(db as never, systemId, confirmed.id, auth), "NOT_FOUND", 404);

      // listBlobs should exclude archived
      const list = await listBlobs(db as never, systemId, auth);
      expect(list.items).toHaveLength(0);
    });
  });

  describe("quota enforcement", () => {
    it("throws QUOTA_EXCEEDED when quota rejects", async () => {
      const storage = createMockBlobStorage();
      const quota = createMockBlobQuota();
      quota.rejectNext();

      await assertApiError(
        createUploadUrl(db as never, storage, quota, systemId, uploadParams(), auth, noopAudit),
        "QUOTA_EXCEEDED",
        413,
      );
    });
  });
});
