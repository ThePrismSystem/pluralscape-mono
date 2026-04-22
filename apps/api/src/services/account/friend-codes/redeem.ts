import { friendCodes, friendConnections } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { withCrossAccountTransaction } from "../../../lib/rls-context.js";
import { dispatchWebhookEvent } from "../../webhook-dispatcher.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  AccountId,
  AuditEventType,
  FriendCodeId,
  FriendConnectionId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a friend code was redeemed. */
const AUDIT_FRIEND_CODE_REDEEMED: AuditEventType = "friend-code.redeemed";

/** Audit event: a friend connection was created. */
const AUDIT_FRIEND_CONNECTION_CREATED: AuditEventType = "friend-connection.created";

export interface RedeemFriendCodeResult {
  readonly connectionIds: readonly [FriendConnectionId, FriendConnectionId];
}

/**
 * Redeem a friend code to create a bidirectional friend connection.
 *
 * Uses SELECT FOR UPDATE to prevent concurrent double-redemption.
 * Creates two directional connection rows (A->B and B->A) both with
 * status "accepted". Archives the code after successful redemption.
 *
 * Dispatches `friend.connected` webhook events to all systems owned by the
 * redeeming account. The code owner's systems are not notified here — they
 * receive events when bucket assignments are made on their systems.
 */
export async function redeemFriendCode(
  db: PostgresJsDatabase,
  code: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RedeemFriendCodeResult> {
  const redeemerId = auth.accountId;
  const timestamp = now();

  // Cross-account transaction: reads code owner's friend_codes, inserts connections
  // for both accounts, and archives the code. Application-level validation (code secret,
  // auth check, self-redeem prevention) replaces RLS for this operation.
  return withCrossAccountTransaction(db, async (tx) => {
    // SELECT FOR UPDATE to prevent concurrent double-redemption
    const [codeRow] = await tx
      .select()
      .from(friendCodes)
      .where(and(eq(friendCodes.code, code), eq(friendCodes.archived, false)))
      .for("update")
      .limit(1);

    if (!codeRow) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend code not found");
    }

    // Check expiry using the database clock for consistency within the transaction
    if (codeRow.expiresAt !== null) {
      const [notExpired] = await tx
        .select({ valid: sql<boolean>`true` })
        .from(friendCodes)
        .where(
          and(
            eq(friendCodes.id, brandId<FriendCodeId>(codeRow.id)),
            sql`${friendCodes.expiresAt} >= NOW()`,
          ),
        )
        .limit(1);

      if (!notExpired) {
        throw new ApiHttpError(HTTP_BAD_REQUEST, "FRIEND_CODE_EXPIRED", "Friend code has expired");
      }
    }

    const codeOwnerId = brandId<AccountId>(codeRow.accountId);

    // Self-redeem prevention
    if (codeOwnerId === redeemerId) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Cannot redeem your own friend code");
    }

    // Already-friends check: look for non-archived connections in either direction
    const [existingConnection] = await tx
      .select({ id: friendConnections.id })
      .from(friendConnections)
      .where(
        and(
          eq(friendConnections.archived, false),
          or(
            and(
              eq(friendConnections.accountId, redeemerId),
              eq(friendConnections.friendAccountId, codeOwnerId),
            ),
            and(
              eq(friendConnections.accountId, codeOwnerId),
              eq(friendConnections.friendAccountId, redeemerId),
            ),
          ),
        ),
      )
      .limit(1);

    if (existingConnection) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Already friends with this account");
    }

    // Create bidirectional connections
    const connectionIdAB = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));
    const connectionIdBA = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));

    const [connAB] = await tx
      .insert(friendConnections)
      .values({
        id: connectionIdAB,
        accountId: codeOwnerId,
        friendAccountId: redeemerId,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: friendConnections.id });

    const [connBA] = await tx
      .insert(friendConnections)
      .values({
        id: connectionIdBA,
        accountId: redeemerId,
        friendAccountId: codeOwnerId,
        status: "pending",
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning({ id: friendConnections.id });

    if (!connAB || !connBA) {
      throw new Error("Failed to create friend connections — INSERT returned no rows");
    }

    // Archive the redeemed code
    await tx
      .update(friendCodes)
      .set({
        archived: true,
        archivedAt: timestamp,
      })
      .where(eq(friendCodes.id, codeRow.id));

    // Audit events
    await audit(tx, {
      eventType: AUDIT_FRIEND_CODE_REDEEMED,
      actor: { kind: "account", id: redeemerId },
      detail: "Friend code redeemed",
      accountId: redeemerId,
      systemId: null,
    });

    await audit(tx, {
      eventType: AUDIT_FRIEND_CONNECTION_CREATED,
      actor: { kind: "account", id: redeemerId },
      detail: "Friend connection created",
      accountId: redeemerId,
      systemId: null,
    });

    // Dispatch friend.connected to all systems owned by the redeemer
    for (const systemId of auth.ownedSystemIds) {
      await dispatchWebhookEvent(tx, systemId, "friend.connected", {
        connectionId: connectionIdBA,
        friendAccountId: codeOwnerId,
      });
    }

    return {
      connectionIds: [
        brandId<FriendConnectionId>(connAB.id),
        brandId<FriendConnectionId>(connBA.id),
      ],
    };
  });
}
