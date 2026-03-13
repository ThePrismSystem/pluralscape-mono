import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pgCleanupAllOrphanedTags, pgCleanupOrphanedTags } from "../queries/orphan-cleanup.js";
import { accounts } from "../schema/pg/auth.js";
import { groups } from "../schema/pg/groups.js";
import { members } from "../schema/pg/members.js";
import { bucketContentTags, buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgGroupsTables,
  pgExec,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  PG_DDL,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { BucketContentEntityType } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, groups, buckets, bucketContentTags };

describe("pgCleanupOrphanedTags", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    // Groups tables include base tables (accounts, systems) + members + groups
    await createPgGroupsTables(client);
    // Add privacy tables manually to avoid re-creating base tables
    await pgExec(client, PG_DDL.buckets);
    await pgExec(client, PG_DDL.bucketsIndexes);
    await pgExec(client, PG_DDL.bucketContentTags);
    await pgExec(client, PG_DDL.bucketContentTagsIndexes);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketContentTags);
    await db.delete(buckets);
    await db.delete(groups);
    await db.delete(members);
  });

  async function insertBucket(systemId: string): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertTag(
    entityType: BucketContentEntityType,
    entityId: string,
    bucketId: string,
    systemId: string,
  ): Promise<void> {
    await db.insert(bucketContentTags).values({ entityType, entityId, bucketId, systemId });
  }

  it("deletes tags whose source entity no longer exists", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);
    const memberId = await pgInsertMember(db, systemId);
    const bucketId = await insertBucket(systemId);

    // Tag referencing an existing member
    await insertTag("member", memberId, bucketId, systemId);
    // Tag referencing a non-existent member (orphan)
    await insertTag("member", crypto.randomUUID(), bucketId, systemId);

    const result = await pgCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(1);

    const remaining = await db.select().from(bucketContentTags);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(memberId);
  });

  it("returns 0 when no orphans exist", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);
    const memberId = await pgInsertMember(db, systemId);
    const bucketId = await insertBucket(systemId);

    await insertTag("member", memberId, bucketId, systemId);

    const result = await pgCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);
  });

  it("returns 0 when table is empty", async () => {
    const result = await pgCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);
  });

  it("only cleans the specified entity type", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);
    const memberId = await pgInsertMember(db, systemId);
    const bucketId = await insertBucket(systemId);

    // Valid member tag
    await insertTag("member", memberId, bucketId, systemId);
    // Orphan tag for group type (no matching group row exists)
    await insertTag("group", crypto.randomUUID(), bucketId, systemId);

    // Clean only member type — group orphan should remain untouched
    const result = await pgCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);

    const remaining = await db.select().from(bucketContentTags);
    expect(remaining).toHaveLength(2);
  });
});

describe("pgCleanupAllOrphanedTags", () => {
  /**
   * Stub tables required by ENTITY_TABLE_MAP that aren't created by
   * createPgGroupsTables (which provides: members, groups).
   */
  const STUB_TABLES = [
    "channels",
    "messages",
    "notes",
    "polls",
    "relationships",
    "subsystems",
    "side_systems",
    "layers",
    "journal_entries",
    "wiki_pages",
    "custom_fronts",
    "fronting_sessions",
    "board_messages",
    "acknowledgements",
    "innerworld_entities",
    "innerworld_regions",
    "field_definitions",
    "field_values",
    "member_photos",
    "fronting_comments",
  ];

  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgGroupsTables(client);
    await pgExec(client, PG_DDL.buckets);
    await pgExec(client, PG_DDL.bucketsIndexes);
    await pgExec(client, PG_DDL.bucketContentTags);
    await pgExec(client, PG_DDL.bucketContentTagsIndexes);
    // Create minimal stub tables so NOT EXISTS subqueries don't fail
    for (const table of STUB_TABLES) {
      await pgExec(client, `CREATE TABLE IF NOT EXISTS ${table} (id VARCHAR PRIMARY KEY)`);
    }
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketContentTags);
    await db.delete(buckets);
    await db.delete(groups);
    await db.delete(members);
  });

  it("returns 0 on empty table", async () => {
    const result = await pgCleanupAllOrphanedTags(db);
    expect(result.deletedCount).toBe(0);
  });
});
