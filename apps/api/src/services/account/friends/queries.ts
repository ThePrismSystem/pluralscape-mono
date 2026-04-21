import { friendConnections } from "@pluralscape/db/pg";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../../http.constants.js";
import { assertAccountOwnership } from "../../../lib/account-ownership.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../../lib/pagination.js";
import { withAccountRead } from "../../../lib/rls-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";

import { toFriendConnectionResult } from "./internal.js";

import type { FriendConnectionResult } from "./internal.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type {
  AccountId,
  FriendConnectionId,
  FriendConnectionStatus,
  PaginatedResult,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListFriendConnectionOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: FriendConnectionStatus;
}

export async function listFriendConnections(
  db: PostgresJsDatabase,
  accountId: AccountId,
  auth: AuthContext,
  opts: ListFriendConnectionOpts = {},
): Promise<PaginatedResult<FriendConnectionResult>> {
  assertAccountOwnership(accountId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const conditions = [eq(friendConnections.accountId, accountId)];

    if (!opts.includeArchived) {
      conditions.push(eq(friendConnections.archived, false));
    }

    if (opts.status) {
      conditions.push(eq(friendConnections.status, opts.status));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "friend-connection");
      const cursorCondition = or(
        lt(friendConnections.createdAt, decoded.sortValue),
        and(
          eq(friendConnections.createdAt, decoded.sortValue),
          lt(friendConnections.id, decoded.id),
        ),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(friendConnections)
      .where(and(...conditions))
      .orderBy(desc(friendConnections.createdAt), desc(friendConnections.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(
      rows,
      effectiveLimit,
      toFriendConnectionResult,
      (i) => i.createdAt,
    );
  });
}

export async function getFriendConnection(
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendConnectionResult> {
  assertAccountOwnership(accountId, auth);

  return withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select()
      .from(friendConnections)
      .where(
        and(
          eq(friendConnections.id, connectionId),
          eq(friendConnections.accountId, accountId),
          eq(friendConnections.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Friend connection not found");
    }

    return toFriendConnectionResult(row);
  });
}
