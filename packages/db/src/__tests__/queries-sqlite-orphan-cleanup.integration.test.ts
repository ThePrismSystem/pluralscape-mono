import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  sqliteCleanupAllOrphanedTags,
  sqliteCleanupOrphanedTags,
} from "../queries/orphan-cleanup.js";
import { accounts } from "../schema/sqlite/auth.js";
import { groups } from "../schema/sqlite/groups.js";
import { members } from "../schema/sqlite/members.js";
import { bucketContentTags, buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteGroupsTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  SQLITE_DDL,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BucketContentEntityType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, groups, buckets, bucketContentTags };

describe("sqliteCleanupOrphanedTags", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteGroupsTables(client);
    // Add privacy tables manually to avoid re-creating base tables
    client.exec(SQLITE_DDL.buckets);
    client.exec(SQLITE_DDL.bucketsIndexes);
    client.exec(SQLITE_DDL.bucketContentTags);
    client.exec(SQLITE_DDL.bucketContentTagsIndexes);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(bucketContentTags).run();
    db.delete(buckets).run();
    db.delete(groups).run();
    db.delete(members).run();
  });

  function insertBucket(systemId: string): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.insert(buckets)
      .values({
        id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertTag(
    entityType: BucketContentEntityType,
    entityId: string,
    bucketId: string,
    systemId: string,
  ): void {
    db.insert(bucketContentTags).values({ entityType, entityId, bucketId, systemId }).run();
  }

  it("deletes tags whose source entity no longer exists", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);
    const memberId = sqliteInsertMember(db, systemId);
    const bucketId = insertBucket(systemId);

    // Tag referencing an existing member
    insertTag("member", memberId, bucketId, systemId);
    // Tag referencing a non-existent member (orphan)
    insertTag("member", crypto.randomUUID(), bucketId, systemId);

    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(1);

    const remaining = db.select().from(bucketContentTags).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(memberId);
  });

  it("returns 0 when no orphans exist", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);
    const memberId = sqliteInsertMember(db, systemId);
    const bucketId = insertBucket(systemId);

    insertTag("member", memberId, bucketId, systemId);

    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);
  });

  it("returns 0 when table is empty", () => {
    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);
  });

  it("removes multiple orphans in one pass", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);
    const memberId = sqliteInsertMember(db, systemId);
    const bucketId = insertBucket(systemId);

    insertTag("member", memberId, bucketId, systemId);
    insertTag("member", crypto.randomUUID(), bucketId, systemId);
    insertTag("member", crypto.randomUUID(), bucketId, systemId);

    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(2);

    const remaining = db.select().from(bucketContentTags).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(memberId);
  });

  it("only cleans the specified entity type", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);
    const memberId = sqliteInsertMember(db, systemId);
    const bucketId = insertBucket(systemId);

    // Valid member tag
    insertTag("member", memberId, bucketId, systemId);
    // Orphan tag for group type (no matching group row exists)
    insertTag("group", crypto.randomUUID(), bucketId, systemId);

    // Clean only member type — group orphan should remain untouched
    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(0);

    const remaining = db.select().from(bucketContentTags).all();
    expect(remaining).toHaveLength(2);
  });
});

describe("sqliteCleanupAllOrphanedTags", () => {
  /**
   * Stub tables required by ENTITY_TABLE_MAP that aren't created by
   * createSqliteGroupsTables (which provides: members, groups).
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

  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteGroupsTables(client);
    client.exec(SQLITE_DDL.buckets);
    client.exec(SQLITE_DDL.bucketsIndexes);
    client.exec(SQLITE_DDL.bucketContentTags);
    client.exec(SQLITE_DDL.bucketContentTagsIndexes);
    // Create minimal stub tables so NOT EXISTS subqueries don't fail
    for (const table of STUB_TABLES) {
      client.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY)`);
    }
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(bucketContentTags).run();
    db.delete(buckets).run();
    db.delete(groups).run();
    db.delete(members).run();
  });

  it("returns 0 on empty table", () => {
    const result = sqliteCleanupAllOrphanedTags(db);
    expect(result.deletedCount).toBe(0);
  });
});
