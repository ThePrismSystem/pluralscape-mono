import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { sqliteCleanupOrphanedTags } from "../queries/orphan-cleanup.js";
import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import { bucketContentTags, buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteMemberTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  SQLITE_DDL,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BucketContentEntityType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, buckets, bucketContentTags };

describe("sqliteCleanupOrphanedTags", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteMemberTables(client);
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
  ): void {
    db.insert(bucketContentTags).values({ entityType, entityId, bucketId }).run();
  }

  it("deletes tags whose source entity no longer exists", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);
    const memberId = sqliteInsertMember(db, systemId);
    const bucketId = insertBucket(systemId);

    // Tag referencing an existing member
    insertTag("member", memberId, bucketId);
    // Tag referencing a non-existent member (orphan)
    insertTag("member", crypto.randomUUID(), bucketId);

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

    insertTag("member", memberId, bucketId);

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

    insertTag("member", memberId, bucketId);
    insertTag("member", crypto.randomUUID(), bucketId);
    insertTag("member", crypto.randomUUID(), bucketId);

    const result = sqliteCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(2);

    const remaining = db.select().from(bucketContentTags).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(memberId);
  });
});
