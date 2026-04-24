import { messages } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { messageIdConditions, toMessageResult } from "./internal.js";

import type { MessageResult, TimestampHint } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  ChannelId,
  MessageId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListMessageOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly before?: UnixMillis;
  readonly after?: UnixMillis;
  readonly includeArchived?: boolean;
}

export async function listMessages(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
  opts: ListMessageOpts = {},
): Promise<PaginatedResult<MessageResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(messages.channelId, channelId), eq(messages.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(messages.archived, false));
    }

    // Timestamp range filters for partition pruning
    if (opts.before !== undefined) {
      conditions.push(lt(messages.timestamp, opts.before));
    }
    if (opts.after !== undefined) {
      conditions.push(gt(messages.timestamp, opts.after));
    }

    // Composite cursor: (timestamp, id) descending
    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "message");
      const sortValue = toUnixMillis(decoded.sortValue);
      const cursorCondition = or(
        lt(messages.timestamp, sortValue),
        and(eq(messages.timestamp, sortValue), lt(messages.id, brandId<MessageId>(decoded.id))),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(sql`${messages.timestamp} DESC, ${messages.id} DESC`)
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toMessageResult, (i) => i.timestamp);
  });
}

export async function getMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  hint?: TimestampHint,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Message not found");
    }

    return toMessageResult(row);
  });
}
