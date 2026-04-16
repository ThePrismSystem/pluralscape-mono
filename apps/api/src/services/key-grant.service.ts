import { authKeys, keyGrants, systems } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, desc, eq, isNull } from "drizzle-orm";

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
 *
 * Joins through systems and auth_keys to include the grantor's box public key,
 * which the client needs for crypto_box decryption.
 *
 * Uses a subquery to select the latest encryption key per account, avoiding
 * duplicate rows when multiple encryption keys exist after key rotation.
 */
export async function listReceivedKeyGrants(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<ReceivedKeyGrantsResponse> {
  // Subquery: latest encryption auth key per account (highest createdAt).
  // After key rotation, accounts can have multiple "encryption" rows —
  // we always want the most recent one.
  const latestEncryptionKey = db
    .selectDistinctOn([authKeys.accountId], {
      accountId: authKeys.accountId,
      publicKey: authKeys.publicKey,
    })
    .from(authKeys)
    .where(eq(authKeys.keyType, "encryption"))
    .orderBy(authKeys.accountId, desc(authKeys.createdAt))
    .as("latest_encryption_key");

  const rows = await db
    .select({
      id: keyGrants.id,
      bucketId: keyGrants.bucketId,
      encryptedKey: keyGrants.encryptedKey,
      keyVersion: keyGrants.keyVersion,
      systemId: keyGrants.systemId,
      senderBoxPublicKey: latestEncryptionKey.publicKey,
    })
    .from(keyGrants)
    .innerJoin(systems, eq(keyGrants.systemId, systems.id))
    .innerJoin(latestEncryptionKey, eq(latestEncryptionKey.accountId, systems.accountId))
    .where(and(eq(keyGrants.friendAccountId, accountId), isNull(keyGrants.revokedAt)));

  return {
    grants: rows.map((r) => ({
      id: brandId<KeyGrantId>(r.id),
      bucketId: brandId<BucketId>(r.bucketId),
      encryptedKey: Buffer.from(r.encryptedKey).toString("base64"),
      keyVersion: r.keyVersion,
      grantorSystemId: brandId<SystemId>(r.systemId),
      senderBoxPublicKey: Buffer.from(r.senderBoxPublicKey).toString("base64url"),
    })),
  };
}
