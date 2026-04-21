import { friendConnections } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { and, eq, sql } from "drizzle-orm";

import { assertAccountOwnership } from "../../lib/account-ownership.js";
import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withAccountTransaction } from "../../lib/rls-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toFriendConnectionResult } from "./internal.js";

import type { FriendConnectionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, AuditEventType, FriendConnectionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface UpdateFriendVisibilityParams {
  readonly encryptedData: string;
  readonly version: number;
}

const AUDIT_VISIBILITY_UPDATED: AuditEventType = "friend-visibility.updated";

export async function updateFriendVisibility(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  params: UpdateFriendVisibilityParams,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  const blob = validateEncryptedBlob(params.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = params.version;
  const timestamp = now();

  return withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendConnections)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${friendConnections.version} + 1`,
      })
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.version, version),
          eq(friendConnections.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: friendConnections.id })
          .from(friendConnections)
          .where(
            and(eq(friendConnections.id, connectionId), eq(friendConnections.accountId, accountId)),
          )
          .limit(1);
        return existing;
      },
      "Friend connection",
    );

    await audit(tx, {
      eventType: AUDIT_VISIBILITY_UPDATED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend visibility updated",
      accountId,
    });

    return toFriendConnectionResult(row);
  });
}
