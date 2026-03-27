import { randomBytes } from "node:crypto";

import { friendCodes, friendConnections } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { and, eq, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { assertAccountOwnership } from "../lib/account-ownership.js";
import { ApiHttpError } from "../lib/api-error.js";
import {
  withAccountRead,
  withAccountTransaction,
  withCrossAccountTransaction,
} from "../lib/rls-context.js";

import {
  FRIEND_CODE_BYTES,
  MAX_CODE_GENERATION_RETRIES,
  MAX_FRIEND_CODES_PER_ACCOUNT,
} from "./friend-code.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  AuditEventType,
  FriendCodeId,
  FriendConnectionId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a friend code was generated. */
const AUDIT_FRIEND_CODE_GENERATED: AuditEventType = "friend-code.generated";

/** Audit event: a friend code was redeemed. */
const AUDIT_FRIEND_CODE_REDEEMED: AuditEventType = "friend-code.redeemed";

/** Audit event: a friend code was archived. */
const AUDIT_FRIEND_CODE_ARCHIVED: AuditEventType = "friend-code.archived";

/** Audit event: a friend connection was created. */
const AUDIT_FRIEND_CONNECTION_CREATED: AuditEventType = "friend-connection.created";

// ── Types ───────────────────────────────────────────────────────────

export interface FriendCodeResult {
  readonly id: FriendCodeId;
  readonly accountId: AccountId;
  readonly code: string;
  readonly createdAt: UnixMillis;
  readonly expiresAt: UnixMillis | null;
  readonly archived: boolean;
}

export interface RedeemFriendCodeResult {
  readonly connectionIds: readonly [FriendConnectionId, FriendConnectionId];
}

interface GenerateFriendCodeOpts {
  readonly expiresAt?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Number of characters in each half of the XXXX-XXXX code. */
const CODE_HALF_LENGTH = 4;

/** Total characters in the code (excluding hyphen). */
const CODE_LENGTH = CODE_HALF_LENGTH * 2;

/** Base for alphanumeric encoding. */
const BASE_36 = 36;

/**
 * Generate a random XXXX-XXXX code from cryptographic random bytes.
 * Interprets bytes as a BigInt, converts to base36, pads to 8 chars.
 * With 8 bytes (~41 bits usable after base36 encoding) this provides
 * adequate collision resistance for the XXXX-XXXX format.
 */
function generateCodeString(): string {
  const bytes = randomBytes(FRIEND_CODE_BYTES);
  const num = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  const raw = num.toString(BASE_36).toUpperCase().padStart(CODE_LENGTH, "0").slice(0, CODE_LENGTH);
  return `${raw.slice(0, CODE_HALF_LENGTH)}-${raw.slice(CODE_HALF_LENGTH)}`;
}

function toFriendCodeResult(row: typeof friendCodes.$inferSelect): FriendCodeResult {
  return {
    id: row.id as FriendCodeId,
    accountId: row.accountId as AccountId,
    code: row.code,
    createdAt: toUnixMillis(row.createdAt),
    expiresAt: toUnixMillisOrNull(row.expiresAt),
    archived: row.archived,
  };
}

// Webhook dispatch for friend events is deferred until "friend.connected"
// is added to WebhookEventType and WebhookEventPayloadMap. When enabled,
// dispatch to all systems owned by both accounts (iterate auth.ownedSystemIds).

// ── GENERATE ────────────────────────────────────────────────────────

/**
 * Generate a new friend code for the given account.
 *
 * Creates a unique XXXX-XXXX formatted code with an optional expiry.
 * Enforces a per-account quota of active (non-archived) codes.
 */
export async function generateFriendCode(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
  audit: AuditWriter,
  opts?: GenerateFriendCodeOpts,
): Promise<FriendCodeResult> {
  return withAccountTransaction(db, accountId, async (tx) => {
    // Quota check — SELECT FOR UPDATE locks matching rows to prevent concurrent quota bypass.
    // Lock the rows first, then count via application code (FOR UPDATE on aggregates is not valid).
    const lockedRows = await tx
      .select({ id: friendCodes.id })
      .from(friendCodes)
      .where(and(eq(friendCodes.accountId, accountId), eq(friendCodes.archived, false)))
      .for("update");

    if (lockedRows.length >= MAX_FRIEND_CODES_PER_ACCOUNT) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_FRIEND_CODES_PER_ACCOUNT)} friend codes per account`,
      );
    }

    // Retry loop for unique constraint collisions on the code value
    let row: typeof friendCodes.$inferSelect | undefined;
    for (let attempt = 0; attempt <= MAX_CODE_GENERATION_RETRIES; attempt++) {
      const codeId = createId(ID_PREFIXES.friendCode) as FriendCodeId;
      const timestamp = now();
      const code = generateCodeString();

      try {
        [row] = await tx
          .insert(friendCodes)
          .values({
            id: codeId,
            accountId,
            code,
            createdAt: timestamp,
            expiresAt: opts?.expiresAt ?? null,
          })
          .returning();
        break;
      } catch (err: unknown) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code: string }).code === "23505";
        if (!isUniqueViolation || attempt === MAX_CODE_GENERATION_RETRIES) {
          throw err;
        }
      }
    }

    if (!row) {
      throw new Error("Failed to create friend code — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_CODE_GENERATED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend code generated",
      accountId,
      systemId: null,
    });

    return toFriendCodeResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

/**
 * List all active, non-expired friend codes for the given account.
 */
export async function listFriendCodes(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
): Promise<readonly FriendCodeResult[]> {
  assertAccountOwnership(accountId, auth);

  return withAccountRead(db, accountId, async (tx) => {
    const rows = await tx
      .select()
      .from(friendCodes)
      .where(
        and(
          eq(friendCodes.accountId, accountId),
          eq(friendCodes.archived, false),
          or(sql`${friendCodes.expiresAt} IS NULL`, sql`${friendCodes.expiresAt} > ${Date.now()}`),
        ),
      )
      .orderBy(sql`${friendCodes.createdAt} DESC`);

    return rows.map(toFriendCodeResult);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

/**
 * Soft-archive a friend code. Returns 404 if the code does not exist
 * or is already archived.
 */
export async function archiveFriendCode(
  db: PostgresJsDatabase,
  accountId: AccountId,
  codeId: FriendCodeId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const timestamp = now();

  await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(friendCodes)
      .set({
        archived: true,
        archivedAt: timestamp,
      })
      .where(
        and(
          eq(friendCodes.id, codeId),
          eq(friendCodes.accountId, accountId),
          eq(friendCodes.archived, false),
        ),
      )
      .returning({ id: friendCodes.id });

    if (updated.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend code not found");
    }

    await audit(tx, {
      eventType: AUDIT_FRIEND_CODE_ARCHIVED,
      actor: { kind: "account", id: auth.accountId },
      detail: "Friend code archived",
      accountId,
      systemId: null,
    });
  });
}

// ── REDEEM ──────────────────────────────────────────────────────────

/**
 * Redeem a friend code to create a bidirectional friend connection.
 *
 * Uses SELECT FOR UPDATE to prevent concurrent double-redemption.
 * Creates two directional connection rows (A->B and B->A) both with
 * status "accepted". Archives the code after successful redemption.
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

    // Check expiry
    if (codeRow.expiresAt !== null && codeRow.expiresAt < Date.now()) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "FRIEND_CODE_EXPIRED", "Friend code has expired");
    }

    const codeOwnerId = codeRow.accountId as AccountId;

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
    const connectionIdAB = createId(ID_PREFIXES.friendConnection) as FriendConnectionId;
    const connectionIdBA = createId(ID_PREFIXES.friendConnection) as FriendConnectionId;

    const [connAB] = await tx
      .insert(friendConnections)
      .values({
        id: connectionIdAB,
        accountId: codeOwnerId,
        friendAccountId: redeemerId,
        status: "accepted",
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
        status: "accepted",
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

    return {
      connectionIds: [connAB.id as FriendConnectionId, connBA.id as FriendConnectionId],
    };
  });
}
