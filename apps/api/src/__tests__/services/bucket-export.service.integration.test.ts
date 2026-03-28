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
import { BUCKET_CONTENT_ENTITY_TYPES, createId, ID_PREFIXES, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getBucketExportManifest,
  getBucketExportPage,
} from "../../services/bucket-export.service.js";
import { asDb, assertApiError, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketContentEntityType,
  BucketId,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags, members } = schema;

/** Number of entity types in the bucket export registry. */
const EXPECTED_ENTITY_TYPE_COUNT = 21;

describe("bucket-export.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let ownerAccountId: AccountId;
  let otherAccountId: AccountId;
  let systemId: SystemId;
  let ownerAuth: AuthContext;
  let otherAuth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    // All entity tables referenced by BUCKET_EXPORT_TABLE_REGISTRY must exist
    await pgExec(client, PG_DDL.members);
    await pgExec(client, PG_DDL.membersIndexes);
    await pgExec(client, PG_DDL.memberPhotos);
    await pgExec(client, PG_DDL.memberPhotosIndexes);
    await pgExec(client, PG_DDL.groups);
    await pgExec(client, PG_DDL.groupsIndexes);
    await pgExec(client, PG_DDL.channels);
    await pgExec(client, PG_DDL.channelsIndexes);
    await pgExec(client, PG_DDL.messages);
    await pgExec(client, PG_DDL.messagesIndexes);
    await pgExec(client, PG_DDL.notes);
    await pgExec(client, PG_DDL.notesIndexes);
    await pgExec(client, PG_DDL.polls);
    await pgExec(client, PG_DDL.pollsIndexes);
    await pgExec(client, PG_DDL.relationships);
    await pgExec(client, PG_DDL.relationshipsIndexes);
    await pgExec(client, PG_DDL.systemStructureEntityTypes);
    await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
    await pgExec(client, PG_DDL.systemStructureEntities);
    await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
    await pgExec(client, PG_DDL.journalEntries);
    await pgExec(client, PG_DDL.journalEntriesIndexes);
    await pgExec(client, PG_DDL.wikiPages);
    await pgExec(client, PG_DDL.wikiPagesIndexes);
    await pgExec(client, PG_DDL.customFronts);
    await pgExec(client, PG_DDL.customFrontsIndexes);
    await pgExec(client, PG_DDL.frontingSessions);
    await pgExec(client, PG_DDL.frontingSessionsIndexes);
    await pgExec(client, PG_DDL.frontingComments);
    await pgExec(client, PG_DDL.frontingCommentsIndexes);
    await pgExec(client, PG_DDL.boardMessages);
    await pgExec(client, PG_DDL.boardMessagesIndexes);
    await pgExec(client, PG_DDL.acknowledgements);
    await pgExec(client, PG_DDL.acknowledgementsIndexes);
    await pgExec(client, PG_DDL.innerworldRegions);
    await pgExec(client, PG_DDL.innerworldRegionsIndexes);
    await pgExec(client, PG_DDL.innerworldEntities);
    await pgExec(client, PG_DDL.innerworldEntitiesIndexes);
    await pgExec(client, PG_DDL.fieldDefinitions);
    await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
    await pgExec(client, PG_DDL.fieldValues);
    await pgExec(client, PG_DDL.fieldValuesIndexes);

    ownerAccountId = (await pgInsertAccount(db)) as AccountId;
    otherAccountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, ownerAccountId)) as SystemId;
    ownerAuth = makeAuth(ownerAccountId, systemId);
    otherAuth = makeAuth(otherAccountId, `sys_${crypto.randomUUID()}` as SystemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketContentTags);
    await db.delete(members);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBucket(archived = false): Promise<BucketId> {
    const id = createId(ID_PREFIXES.bucket);
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
      archived,
      archivedAt: archived ? ts : null,
    });
    return id as BucketId;
  }

  async function insertMember(updatedAt?: number): Promise<MemberId> {
    const id = createId(ID_PREFIXES.member);
    const ts = updatedAt ?? now();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return id as MemberId;
  }

  async function insertBucketTag(
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

  // ── Manifest tests ────────────────────────────────────────────────

  it("returns zero counts for empty bucket", async () => {
    const bucketId = await insertBucket();

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketId, ownerAuth);

    expect(manifest.systemId).toBe(systemId);
    expect(manifest.bucketId).toBe(bucketId);
    for (const entry of manifest.entries) {
      expect(entry.count).toBe(0);
      expect(entry.lastUpdatedAt).toBeNull();
    }
  });

  it("returns correct count for tagged members", async () => {
    const bucketId = await insertBucket();
    const m1 = await insertMember();
    const m2 = await insertMember();
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketId, ownerAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry).toBeDefined();
    expect(memberEntry?.count).toBe(2);
  });

  it("returns correct maxUpdatedAt timestamp", async () => {
    const bucketId = await insertBucket();
    const baseTs = now();
    const laterTs = baseTs + 5000;

    const m1 = await insertMember(baseTs);
    const m2 = await insertMember(laterTs);
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketId, ownerAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.lastUpdatedAt).toBe(laterTs);
  });

  it("returns entries for all 21 entity types", async () => {
    const bucketId = await insertBucket();

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketId, ownerAuth);

    expect(manifest.entries).toHaveLength(EXPECTED_ENTITY_TYPE_COUNT);
    const returnedTypes = manifest.entries.map((e) => e.entityType).sort();
    const expectedTypes = [...BUCKET_CONTENT_ENTITY_TYPES].sort();
    expect(returnedTypes).toEqual(expectedTypes);
  });

  it("only counts entities tagged with the specific bucket", async () => {
    const bucketA = await insertBucket();
    const bucketB = await insertBucket();

    const taggedMember = await insertMember();
    const untaggedMember = await insertMember();
    await insertBucketTag("member", taggedMember, bucketA);
    await insertBucketTag("member", untaggedMember, bucketB);

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketA, ownerAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.count).toBe(1);
  });

  it("excludes archived entities from manifest counts", async () => {
    const bucketId = await insertBucket();
    const mid = await insertMember();
    await insertBucketTag("member", mid, bucketId);

    // Archive the member
    await db.update(members).set({ archived: true, archivedAt: now() }).where(eq(members.id, mid));

    const manifest = await getBucketExportManifest(asDb(db), systemId, bucketId, ownerAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.count).toBe(0);
  });

  it("throws 404 for non-existent bucket", async () => {
    const fakeBucketId = `bkt_${crypto.randomUUID()}` as BucketId;

    await assertApiError(
      getBucketExportManifest(asDb(db), systemId, fakeBucketId, ownerAuth),
      "NOT_FOUND",
      404,
    );
  });

  it("throws 404 for archived bucket", async () => {
    const archivedBucketId = await insertBucket(true);

    await assertApiError(
      getBucketExportManifest(asDb(db), systemId, archivedBucketId, ownerAuth),
      "NOT_FOUND",
      404,
    );
  });

  it("throws 404 for non-owner system", async () => {
    const bucketId = await insertBucket();

    await assertApiError(
      getBucketExportManifest(asDb(db), systemId, bucketId, otherAuth),
      "NOT_FOUND",
      404,
    );
  });

  // ── Page tests ────────────────────────────────────────────────────

  it("returns entities tagged with the bucket", async () => {
    const bucketId = await insertBucket();
    const mid = await insertMember();
    await insertBucketTag("member", mid, bucketId);

    const page = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 10);

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(mid);
    expect(page.items[0]?.entityType).toBe("member");
    expect(page.items[0]?.encryptedData).toEqual(expect.any(String));
  });

  it("excludes entities not tagged with the bucket", async () => {
    const bucketA = await insertBucket();
    const bucketB = await insertBucket();
    const taggedMember = await insertMember();
    const untaggedMember = await insertMember();
    await insertBucketTag("member", taggedMember, bucketA);
    await insertBucketTag("member", untaggedMember, bucketB);

    const page = await getBucketExportPage(asDb(db), systemId, bucketA, ownerAuth, "member", 10);

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(taggedMember);
    const ids = page.items.map((i) => i.id);
    expect(ids).not.toContain(untaggedMember);
  });

  it("excludes archived entities", async () => {
    const bucketId = await insertBucket();
    const mid = await insertMember();
    await insertBucketTag("member", mid, bucketId);
    await db.update(members).set({ archived: true, archivedAt: now() }).where(eq(members.id, mid));

    const page = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 10);

    expect(page.items).toHaveLength(0);
  });

  it("paginates correctly with limit", async () => {
    const bucketId = await insertBucket();
    const baseTs = now();
    for (let i = 0; i < 3; i++) {
      const mid = await insertMember(baseTs + i * 1000);
      await insertBucketTag("member", mid, bucketId);
    }

    const page1 = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 2);

    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();
  });

  it("cursor follows to next page", async () => {
    const bucketId = await insertBucket();
    const baseTs = now();
    const memberIds: MemberId[] = [];
    for (let i = 0; i < 3; i++) {
      const mid = await insertMember(baseTs + i * 1000);
      await insertBucketTag("member", mid, bucketId);
      memberIds.push(mid);
    }

    const page1 = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 2);
    const page2 = await getBucketExportPage(
      asDb(db),
      systemId,
      bucketId,
      ownerAuth,
      "member",
      2,
      page1.nextCursor ?? undefined,
    );

    expect(page2.items).toHaveLength(1);
    expect(page2.hasMore).toBe(false);

    // Pages must not overlap
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it("returns empty page for entity type with no tagged entities", async () => {
    const bucketId = await insertBucket();

    const page = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "group", 10);

    expect(page.items).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("hasMore is false when all entities fit in one page", async () => {
    const bucketId = await insertBucket();
    const mid = await insertMember();
    await insertBucketTag("member", mid, bucketId);

    const page = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 10);

    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("orders by updatedAt ASC, id ASC", async () => {
    const bucketId = await insertBucket();
    const baseTs = now();
    const m1 = await insertMember(baseTs);
    const m2 = await insertMember(baseTs + 2000);
    const m3 = await insertMember(baseTs + 1000);
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);
    await insertBucketTag("member", m3, bucketId);

    const page = await getBucketExportPage(asDb(db), systemId, bucketId, ownerAuth, "member", 10);

    expect(page.items[0]?.id).toBe(m1);
    expect(page.items[1]?.id).toBe(m3);
    expect(page.items[2]?.id).toBe(m2);
  });

  it("throws 404 for non-existent bucket (page)", async () => {
    const fakeBucketId = `bkt_${crypto.randomUUID()}` as BucketId;

    await assertApiError(
      getBucketExportPage(asDb(db), systemId, fakeBucketId, ownerAuth, "member", 10),
      "NOT_FOUND",
      404,
    );
  });

  it("throws 404 for archived bucket (page)", async () => {
    const archivedBucketId = await insertBucket(true);

    await assertApiError(
      getBucketExportPage(asDb(db), systemId, archivedBucketId, ownerAuth, "member", 10),
      "NOT_FOUND",
      404,
    );
  });

  it("throws 404 for non-owner system (page)", async () => {
    const bucketId = await insertBucket();

    await assertApiError(
      getBucketExportPage(asDb(db), systemId, bucketId, otherAuth, "member", 10),
      "NOT_FOUND",
      404,
    );
  });
});
