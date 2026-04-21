import { keyGrants } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import type {
  AccountId,
  BucketId,
  FriendDashboardResponse,
  KeyGrantId,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Fetch active (non-revoked) key grants for this friend. */
export async function queryActiveKeyGrants(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendAccountId: AccountId,
): Promise<FriendDashboardResponse["keyGrants"]> {
  const rows = await tx
    .select({
      id: keyGrants.id,
      bucketId: keyGrants.bucketId,
      encryptedKey: keyGrants.encryptedKey,
      keyVersion: keyGrants.keyVersion,
    })
    .from(keyGrants)
    .where(
      and(
        eq(keyGrants.systemId, systemId),
        eq(keyGrants.friendAccountId, friendAccountId),
        isNull(keyGrants.revokedAt),
      ),
    );

  return rows.map((r) => ({
    id: brandId<KeyGrantId>(r.id),
    bucketId: brandId<BucketId>(r.bucketId),
    encryptedKey: Buffer.from(r.encryptedKey).toString("base64"),
    keyVersion: r.keyVersion,
  }));
}
