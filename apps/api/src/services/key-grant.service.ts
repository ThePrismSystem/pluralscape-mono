import { keyGrants } from "@pluralscape/db/pg";
import { and, eq, isNull } from "drizzle-orm";

import type {
  AccountId,
  BucketId,
  KeyGrantId,
  ReceivedKeyGrantsResponse,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * List all active (non-revoked) key grants where the given account is the recipient.
 *
 * Unlike `queryActiveKeyGrants` (which is scoped to a single system+friend pair),
 * this returns grants across ALL friends for eager client-side key loading.
 */
export async function listReceivedKeyGrants(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<ReceivedKeyGrantsResponse> {
  const rows = await db
    .select({
      id: keyGrants.id,
      bucketId: keyGrants.bucketId,
      encryptedKey: keyGrants.encryptedKey,
      keyVersion: keyGrants.keyVersion,
      systemId: keyGrants.systemId,
    })
    .from(keyGrants)
    .where(and(eq(keyGrants.friendAccountId, accountId), isNull(keyGrants.revokedAt)));

  return {
    grants: rows.map((r) => ({
      id: r.id as KeyGrantId,
      bucketId: r.bucketId as BucketId,
      encryptedKey: Buffer.from(r.encryptedKey).toString("base64"),
      keyVersion: r.keyVersion,
      grantorSystemId: r.systemId as SystemId,
    })),
  };
}
