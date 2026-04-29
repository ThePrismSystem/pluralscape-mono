import { friendCodes } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import { assertAccountOwnership } from "../../../lib/account-ownership.js";
import { narrowArchivableRow } from "../../../lib/archivable-row.js";
import { buildPaginatedResult } from "../../../lib/pagination.js";
import { withAccountRead } from "../../../lib/rls-context.js";

import { toFriendCodeResult, type FriendCodeResult } from "./internal.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, FriendCode, FriendCodeId, PaginatedResult } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Default page size for friend code listing. */
const FRIEND_CODE_DEFAULT_LIMIT = 20;

/** Maximum page size for friend code listing. */
const FRIEND_CODE_MAX_LIMIT = 100;

/**
 * List active, non-expired friend codes for the given account with cursor pagination.
 * Uses descending ID order for stable, cursor-based paging.
 */
export async function listFriendCodes(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
  cursor?: string,
  limit = FRIEND_CODE_DEFAULT_LIMIT,
): Promise<PaginatedResult<FriendCodeResult>> {
  assertAccountOwnership(accountId, auth);

  const effectiveLimit = Math.min(limit, FRIEND_CODE_MAX_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const conditions = [
      eq(friendCodes.accountId, accountId),
      eq(friendCodes.archived, false),
      or(
        sql`${friendCodes.expiresAt} IS NULL`,
        sql`${friendCodes.expiresAt} > ${new Date(Date.now()).toISOString()}::timestamptz`,
      ),
    ];

    if (cursor) {
      conditions.push(lt(friendCodes.id, brandId<FriendCodeId>(cursor)));
    }

    const rows = await tx
      .select()
      .from(friendCodes)
      .where(and(...conditions))
      .orderBy(desc(friendCodes.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, (row) =>
      toFriendCodeResult(narrowArchivableRow<FriendCode>(row)),
    );
  });
}
