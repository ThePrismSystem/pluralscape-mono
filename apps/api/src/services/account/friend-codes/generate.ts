import { randomBytes } from "node:crypto";

import { friendCodes } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { narrowArchivableRow } from "../../../lib/archivable-row.js";
import { withAccountTransaction } from "../../../lib/rls-context.js";
import { isUniqueViolation } from "../../../lib/unique-violation.js";
import { MAX_FRIEND_CODES_PER_ACCOUNT } from "../../../quota.constants.js";
import { FRIEND_CODE_BYTES, MAX_CODE_GENERATION_RETRIES } from "../../friend-code.constants.js";

import { type FriendCodeResult } from "./internal.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, AuditEventType, FriendCode, FriendCodeId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Audit event: a friend code was generated. */
const AUDIT_FRIEND_CODE_GENERATED: AuditEventType = "friend-code.generated";

interface GenerateFriendCodeOpts {
  readonly expiresAt?: number;
}

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
      const codeId = brandId<FriendCodeId>(createId(ID_PREFIXES.friendCode));
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
            expiresAt: opts?.expiresAt !== undefined ? toUnixMillis(opts.expiresAt) : null,
          })
          .returning();
        break;
      } catch (err: unknown) {
        if (!isUniqueViolation(err) || attempt === MAX_CODE_GENERATION_RETRIES) {
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

    return narrowArchivableRow<FriendCode>(row);
  });
}
