import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { createId, ID_PREFIXES, now, brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MAX_BUCKETS_PER_SYSTEM } from "../../quota.constants.js";
import {
  archiveBucket,
  createBucket,
  deleteBucket,
  getBucket,
  listBuckets,
  parseBucketQuery,
  restoreBucket,
  updateBucket,
} from "../../services/bucket.service.js";
import {
  assertApiError,
  asDb,
  genBucketId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const {
  buckets,
  bucketContentTags,
  keyGrants,
  friendBucketAssignments,
  bucketKeyRotations,
  fieldBucketVisibility,
} = schema;

describe("bucket.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    // Additional tables needed for checkBucketDependents and dispatchWebhookEvent
    await pgExec(client, PG_DDL.bucketKeyRotations);
    await pgExec(client, PG_DDL.bucketKeyRotationsIndexes);
    await pgExec(client, PG_DDL.fieldDefinitions);
    await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
    await pgExec(client, PG_DDL.fieldBucketVisibility);
    await pgExec(client, PG_DDL.fieldBucketVisibilityIndexes);
    await pgExec(client, PG_DDL.apiKeys);
    await pgExec(client, PG_DDL.apiKeysIndexes);
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(fieldBucketVisibility);
    await db.delete(bucketContentTags);
    await db.delete(keyGrants);
    await db.delete(friendBucketAssignments);
    await db.delete(bucketKeyRotations);
    await db.delete(buckets);
  });

  // ── createBucket ──────────────────────────────────────────────────

  describe("createBucket", () => {
    it("creates a bucket and returns expected shape", async () => {
      const result = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^bkt_/);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.systemId).toBe(systemId);
    });

    it("writes audit event bucket.created", async () => {
      const audit = spyAudit();
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("bucket.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });

    it("enforces QUOTA_EXCEEDED", async () => {
      const timestamp = now();
      const values = Array.from({ length: MAX_BUCKETS_PER_SYSTEM }, () => ({
        id: createId(ID_PREFIXES.bucket),
        systemId,
        encryptedData: testBlob(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      await db.insert(buckets).values(values);

      await assertApiError(
        createBucket(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64() },
          auth,
          noopAudit,
        ),
        "QUOTA_EXCEEDED",
        400,
      );
    });
  });

  // ── getBucket ─────────────────────────────────────────────────────

  describe("getBucket", () => {
    it("retrieves a created bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await getBucket(asDb(db), systemId, created.id, auth);

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(created.version);
    });

    it("returns NOT_FOUND for nonexistent ID", async () => {
      await assertApiError(getBucket(asDb(db), systemId, genBucketId(), auth), "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND for archived bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveBucket(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getBucket(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });

  // ── listBuckets ───────────────────────────────────────────────────

  describe("listBuckets", () => {
    it("lists all non-archived buckets", async () => {
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await listBuckets(asDb(db), systemId, auth);

      expect(result.data.length).toBeGreaterThanOrEqual(2);
    });

    it("supports cursor pagination", async () => {
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const page1 = await listBuckets(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(typeof page1.nextCursor).toBe("string");

      const page2 = await listBuckets(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it("includes archived when includeArchived=true", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveBucket(asDb(db), systemId, created.id, auth, noopAudit);

      const result = await listBuckets(asDb(db), systemId, auth, { includeArchived: true });
      const ids = result.data.map((i) => i.id);

      expect(ids).toContain(created.id);
    });

    it("returns empty list when no buckets", async () => {
      const result = await listBuckets(asDb(db), systemId, auth);

      expect(result.data).toHaveLength(0);
    });
  });

  // ── updateBucket ──────────────────────────────────────────────────

  describe("updateBucket", () => {
    it("updates with OCC version check", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const updated = await updateBucket(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(updated.version).toBe(2);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("bucket.updated");
    });

    it("returns CONFLICT on version mismatch", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateBucket(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 999 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        updateBucket(
          asDb(db),
          systemId,
          genBucketId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── deleteBucket ──────────────────────────────────────────────────

  describe("deleteBucket", () => {
    it("deletes bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await deleteBucket(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getBucket(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        deleteBucket(asDb(db), systemId, genBucketId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("returns HAS_DEPENDENTS when bucket has content tags", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await db.insert(bucketContentTags).values({
        entityType: "member",
        entityId: "mem_test",
        bucketId: created.id,
        systemId,
      });

      await assertApiError(
        deleteBucket(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });
  });

  // ── archiveBucket ─────────────────────────────────────────────────

  describe("archiveBucket", () => {
    it("archives active bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveBucket(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getBucket(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("returns ALREADY_ARCHIVED", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveBucket(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archiveBucket(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });
  });

  // ── restoreBucket ─────────────────────────────────────────────────

  describe("restoreBucket", () => {
    it("restores archived bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveBucket(asDb(db), systemId, created.id, auth, noopAudit);

      const restored = await restoreBucket(asDb(db), systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
      expect(restored.id).toBe(created.id);
    });

    it("returns NOT_ARCHIVED for active", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await assertApiError(
        restoreBucket(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });
  });

  // ── cross-system isolation ────────────────────────────────────────

  describe("cross-system isolation", () => {
    let otherAccountId: AccountId;
    let otherSystemId: SystemId;
    let otherAuth: AuthContext;

    beforeAll(async () => {
      otherAccountId = brandId<AccountId>(await pgInsertAccount(db));
      otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));
      otherAuth = makeAuth(otherAccountId, otherSystemId);
    });

    it("cannot access another system's bucket", async () => {
      const created = await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await assertApiError(
        getBucket(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return other system's buckets", async () => {
      await createBucket(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await listBuckets(asDb(db), otherSystemId, otherAuth);

      expect(result.data).toHaveLength(0);
    });
  });

  // ── parseBucketQuery ──────────────────────────────────────────────

  describe("parseBucketQuery", () => {
    it("parses includeArchived from query", () => {
      const result = parseBucketQuery({ includeArchived: "true" });

      expect(result.includeArchived).toBe(true);
    });

    it("defaults includeArchived to false", () => {
      const result = parseBucketQuery({});

      expect(result.includeArchived).toBe(false);
    });
  });
});
