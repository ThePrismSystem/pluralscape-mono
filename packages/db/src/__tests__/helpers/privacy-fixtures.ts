/**
 * Shared fixtures for PG privacy schema integration tests.
 *
 * Used by schema-pg-privacy-buckets-tags-grants,
 * -friend-connections, and -friend-codes-assignments splits.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import { accounts } from "../../schema/pg/auth.js";
import {
  bucketContentTags,
  buckets,
  friendBucketAssignments,
  friendCodes,
  friendConnections,
  keyGrants,
} from "../../schema/pg/privacy.js";
import { systems } from "../../schema/pg/systems.js";
import { fixtureNow } from "../fixtures/timestamps.js";

import { createPgPrivacyTables, pgInsertAccount, pgInsertSystem, testBlob } from "./pg-helpers.js";

import type { AccountId, BucketId, FriendConnectionId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const privacySchema = {
  accounts,
  systems,
  buckets,
  bucketContentTags,
  keyGrants,
  friendConnections,
  friendCodes,
  friendBucketAssignments,
};

export type PrivacyDb = PgliteDatabase<typeof privacySchema>;

export interface PrivacyFixture {
  client: PGlite;
  db: PrivacyDb;
}

export async function setupPrivacyFixture(): Promise<PrivacyFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: privacySchema });
  await createPgPrivacyTables(client);
  return { client, db };
}

export async function teardownPrivacyFixture(fixture: PrivacyFixture): Promise<void> {
  await fixture.client.close();
}

export async function clearPrivacyTables(db: PrivacyDb): Promise<void> {
  await db.delete(friendCodes);
  await db.delete(friendBucketAssignments);
  await db.delete(friendConnections);
  await db.delete(keyGrants);
  await db.delete(bucketContentTags);
  await db.delete(buckets);
}

export const insertAccount = (db: PrivacyDb, id?: string): Promise<AccountId> =>
  pgInsertAccount(db, id);
export const insertSystem = (db: PrivacyDb, accountId: AccountId, id?: string): Promise<SystemId> =>
  pgInsertSystem(db, accountId, id);

export async function insertBucket(
  db: PrivacyDb,
  systemId: SystemId,
  id: BucketId = brandId<BucketId>(crypto.randomUUID()),
): Promise<BucketId> {
  const now = fixtureNow();
  await db.insert(buckets).values({
    id,
    systemId,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function insertFriendConnection(
  db: PrivacyDb,
  accountId: AccountId,
  friendAccountId: AccountId,
  id: FriendConnectionId = brandId<FriendConnectionId>(crypto.randomUUID()),
): Promise<FriendConnectionId> {
  const now = fixtureNow();
  await db.insert(friendConnections).values({
    id,
    accountId,
    friendAccountId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
