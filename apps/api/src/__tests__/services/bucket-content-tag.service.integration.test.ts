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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  listTagsByBucket,
  tagContent,
  untagContent,
} from "../../services/bucket-content-tag.service.js";
import { clearWebhookConfigCache } from "../../services/webhook-dispatcher.js";
import {
  asDb,
  assertApiError,
  genBucketId,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, BucketId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags } = schema;

describe("bucket-content-tag.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);
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
    clearWebhookConfigCache();
    await db.delete(bucketContentTags);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBucket(): Promise<BucketId> {
    const id = brandId<BucketId>(createId(ID_PREFIXES.bucket));
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<BucketId>(id);
  }

  // ── tagContent ──────────────────────────────────────────────────────

  describe("tagContent", () => {
    it("tags content and returns expected shape", async () => {
      const bucketId = await insertBucket();
      const audit = spyAudit();

      const result = await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        audit,
      );

      expect(result.entityType).toBe("member");
      expect(result.entityId).toBe("mem_990e8400-e29b-41d4-a716-446655440001");
      expect(result.bucketId).toBe(bucketId);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("bucket-content-tag.tagged");
    });

    it("is idempotent — no duplicate audit on second call", async () => {
      const bucketId = await insertBucket();

      const firstAudit = spyAudit();
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        firstAudit,
      );
      expect(firstAudit.calls).toHaveLength(1);

      const secondAudit = spyAudit();
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        secondAudit,
      );
      expect(secondAudit.calls).toHaveLength(0);
    });

    it("returns VALIDATION_ERROR for invalid entityType", async () => {
      const bucketId = await insertBucket();

      await assertApiError(
        tagContent(
          asDb(db),
          systemId,
          bucketId,
          { entityType: "invalid", entityId: "x" },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── untagContent ────────────────────────────────────────────────────

  describe("untagContent", () => {
    it("untags content", async () => {
      const bucketId = await insertBucket();
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await untagContent(
        asDb(db),
        systemId,
        bucketId,
        {
          entityType: "member",
          entityId: brandId<MemberId>("mem_990e8400-e29b-41d4-a716-446655440001"),
        },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("bucket-content-tag.untagged");
    });

    it("returns NOT_FOUND when tag does not exist", async () => {
      const bucketId = await insertBucket();

      await assertApiError(
        untagContent(
          asDb(db),
          systemId,
          bucketId,
          {
            entityType: "member",
            entityId: brandId<MemberId>(`mem_${crypto.randomUUID()}`),
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── listTagsByBucket ────────────────────────────────────────────────

  describe("listTagsByBucket", () => {
    it("lists all tags for a bucket", async () => {
      const bucketId = await insertBucket();
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        noopAudit,
      );
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "group", entityId: "grp_bb0e8400-e29b-41d4-a716-446655440002" },
        auth,
        noopAudit,
      );

      const tags = await listTagsByBucket(asDb(db), systemId, bucketId, auth);

      expect(tags).toHaveLength(2);
    });

    it("filters by entityType", async () => {
      const bucketId = await insertBucket();
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
        auth,
        noopAudit,
      );
      await tagContent(
        asDb(db),
        systemId,
        bucketId,
        { entityType: "group", entityId: "grp_bb0e8400-e29b-41d4-a716-446655440002" },
        auth,
        noopAudit,
      );

      const tags = await listTagsByBucket(asDb(db), systemId, bucketId, auth, {
        entityType: "member",
      });

      expect(tags).toHaveLength(1);
      expect(tags[0]?.entityType).toBe("member");
    });
  });

  // ── assertBucketExists via tagContent ───────────────────────────────

  describe("assertBucketExists via tagContent", () => {
    it("returns NOT_FOUND for non-existent bucket", async () => {
      await assertApiError(
        tagContent(
          asDb(db),
          systemId,
          genBucketId(),
          { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("returns NOT_FOUND for archived bucket", async () => {
      const bucketId = await insertBucket();
      await db
        .update(buckets)
        .set({ archived: true, archivedAt: now() })
        .where(eq(buckets.id, bucketId));

      await assertApiError(
        tagContent(
          asDb(db),
          systemId,
          bucketId,
          { entityType: "member", entityId: "mem_990e8400-e29b-41d4-a716-446655440001" },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });
});
