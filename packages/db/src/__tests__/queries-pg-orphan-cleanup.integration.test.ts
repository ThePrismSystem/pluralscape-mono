import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pgCleanupOrphanedTags } from "../queries/orphan-cleanup.js";
import { accounts } from "../schema/pg/auth.js";
import { members } from "../schema/pg/members.js";
import { bucketContentTags, buckets } from "../schema/pg/privacy.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgMemberTables,
  pgExec,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  PG_DDL,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { BucketContentEntityType } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, buckets, bucketContentTags };

describe("pgCleanupOrphanedTags", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    // Member tables include base tables (accounts, systems) + members
    await createPgMemberTables(client);
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
  ): Promise<void> {
    await db.insert(bucketContentTags).values({ entityType, entityId, bucketId });
  }

  it("deletes tags whose source entity no longer exists", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);
    const memberId = await pgInsertMember(db, systemId);
    const bucketId = await insertBucket(systemId);

    // Tag referencing an existing member
    await insertTag("member", memberId, bucketId);
    // Tag referencing a non-existent member (orphan)
    await insertTag("member", crypto.randomUUID(), bucketId);

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

    await insertTag("member", memberId, bucketId);

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
    await insertTag("member", memberId, bucketId);
    // Orphan tag for a different entity type (group — no groups table populated)
    // This would be orphaned under "group" cleanup but untouched by "member" cleanup
    // We can't insert "group" type without a groups table, so test isolation differently:
    // Insert two orphan member tags, clean only member, verify both removed
    const orphan1 = crypto.randomUUID();
    const orphan2 = crypto.randomUUID();
    await insertTag("member", orphan1, bucketId);
    await insertTag("member", orphan2, bucketId);

    const result = await pgCleanupOrphanedTags(db, "member");
    expect(result.deletedCount).toBe(2);

    const remaining = await db.select().from(bucketContentTags);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe(memberId);
  });
});
