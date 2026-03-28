import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { createId, ID_PREFIXES, now } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { loadBucketTags } from "../../lib/bucket-access.js";
import { MAX_IN_CLAUSE_SIZE } from "../../service.constants.js";
import { asDb, genBucketId, genGroupId, genMemberId } from "../helpers/integration-setup.js";

import type { BucketContentEntityType, BucketId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { bucketContentTags, buckets } = schema;

describe("loadBucketTags (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    const accountId = await pgInsertAccount(db);
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketContentTags);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBucket(id?: BucketId): Promise<BucketId> {
    const bucketId = id ?? genBucketId();
    const ts = now();
    await db.insert(buckets).values({
      id: bucketId,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return bucketId;
  }

  async function insertTag(
    entityType: BucketContentEntityType,
    entityId: string,
    bucketId: BucketId,
  ): Promise<void> {
    await db.insert(bucketContentTags).values({
      entityType,
      entityId,
      bucketId,
      systemId,
    });
  }

  // ── Tests ───────────────────────────────────────────────────────────

  it("returns correct entity-to-bucket mapping for tagged entities", async () => {
    const bucketA = await insertBucket();
    const bucketB = await insertBucket();
    const memberA = genMemberId();
    const memberB = genMemberId();

    await insertTag("member", memberA, bucketA);
    await insertTag("member", memberB, bucketB);

    const result = await loadBucketTags(asDb(db), systemId, "member", [memberA, memberB]);

    expect(result.size).toBe(2);
    expect(result.get(memberA)).toEqual([bucketA]);
    expect(result.get(memberB)).toEqual([bucketB]);
  });

  it("returns empty map for empty entity IDs array", async () => {
    const result = await loadBucketTags(asDb(db), systemId, "member", []);

    expect(result.size).toBe(0);
  });

  it("handles entities with multiple bucket tags", async () => {
    const bucketA = await insertBucket();
    const bucketB = await insertBucket();
    const bucketC = await insertBucket();
    const memberId = genMemberId();

    await insertTag("member", memberId, bucketA);
    await insertTag("member", memberId, bucketB);
    await insertTag("member", memberId, bucketC);

    const result = await loadBucketTags(asDb(db), systemId, "member", [memberId]);

    expect(result.size).toBe(1);
    const bucketIds = result.get(memberId);
    expect(bucketIds).toBeDefined();
    expect(bucketIds).toHaveLength(3);
    expect(new Set(bucketIds)).toEqual(new Set([bucketA, bucketB, bucketC]));
  });

  it("returns empty map when no tags exist for given entities", async () => {
    const memberId = genMemberId();

    const result = await loadBucketTags(asDb(db), systemId, "member", [memberId]);

    expect(result.size).toBe(0);
  });

  it("only returns tags for the specified entityType", async () => {
    const bucket = await insertBucket();
    const memberId = genMemberId();
    const groupId = genGroupId();

    await insertTag("member", memberId, bucket);
    await insertTag("group", groupId, bucket);

    const memberResult = await loadBucketTags(asDb(db), systemId, "member", [memberId, groupId]);

    expect(memberResult.size).toBe(1);
    expect(memberResult.get(memberId)).toEqual([bucket]);
    expect(memberResult.has(groupId)).toBe(false);

    const groupResult = await loadBucketTags(asDb(db), systemId, "group", [memberId, groupId]);

    expect(groupResult.size).toBe(1);
    expect(groupResult.get(groupId)).toEqual([bucket]);
    expect(groupResult.has(memberId)).toBe(false);
  });

  it("batches IN clause for large entity sets", async () => {
    const entityCount = MAX_IN_CLAUSE_SIZE + 1;
    const bucket = await insertBucket();

    const entityIds: string[] = [];
    for (let i = 0; i < entityCount; i++) {
      entityIds.push(createId(ID_PREFIXES.member));
    }

    // Batch-insert tags to avoid inserting one-by-one
    const tagRows = entityIds.map((entityId) => ({
      entityType: "member" as BucketContentEntityType,
      entityId,
      bucketId: bucket,
      systemId,
    }));

    // Insert in chunks to avoid exceeding PGlite parameter limits
    const INSERT_CHUNK = 200;
    for (let i = 0; i < tagRows.length; i += INSERT_CHUNK) {
      await db.insert(bucketContentTags).values(tagRows.slice(i, i + INSERT_CHUNK));
    }

    const result = await loadBucketTags(asDb(db), systemId, "member", entityIds);

    expect(result.size).toBe(entityCount);

    for (const entityId of entityIds) {
      expect(result.get(entityId)).toEqual([bucket]);
    }
  });
});
