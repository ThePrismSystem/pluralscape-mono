/**
 * Shared test helpers for bucket/rotations integration tests.
 * Used by initiate, claim-complete, and queries-retry-lifecycle suites.
 */
import * as schema from "@pluralscape/db/pg";
import { testBlob } from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";

import { asDb, genBucketId } from "../../../helpers/integration-setup.js";

import type { BucketId, KeyGrantId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags } = schema;

/** Insert a bucket row and return its branded ID. */
export async function insertBucket(
  db: PgliteDatabase<typeof schema>,
  systemId: string,
  id?: BucketId,
): Promise<BucketId> {
  const resolvedId = id ?? genBucketId();
  const ts = toUnixMillis(Date.now());
  await db.insert(buckets).values({
    id: resolvedId,
    systemId,
    encryptedData: testBlob(),
    createdAt: ts,
    updatedAt: ts,
  });
  return brandId<BucketId>(resolvedId);
}

/** Insert N content tag rows for a bucket, returning the entity IDs. */
export async function insertContentTags(
  db: PgliteDatabase<typeof schema>,
  systemId: string,
  bucketId: BucketId,
  count: number,
): Promise<string[]> {
  const entityIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const entityId = crypto.randomUUID();
    entityIds.push(entityId);
    await db.insert(bucketContentTags).values({ entityType: "member", entityId, bucketId, systemId });
  }
  return entityIds;
}

/** Standard initiate payload: wrappedNewKey, newKeyVersion, no friend grants. */
export function initiateParams(newKeyVersion = 2) {
  return {
    wrappedNewKey: "wrapped-key-base64",
    newKeyVersion,
    friendKeyGrants: [],
  };
}
