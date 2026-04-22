import { channels } from "@pluralscape/db/pg";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toChannelResult } from "./internal.js";

import type { ChannelResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListChannelOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly type?: "category" | "channel";
  readonly parentId?: ChannelId;
  readonly includeArchived?: boolean;
}

export async function listChannels(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListChannelOpts = {},
): Promise<PaginatedResult<ChannelResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(channels.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(channels.archived, false));
    }

    if (opts.type) {
      conditions.push(eq(channels.type, opts.type));
    }

    if (opts.parentId) {
      conditions.push(eq(channels.parentId, opts.parentId));
    }

    if (opts.cursor) {
      conditions.push(gt(channels.id, opts.cursor));
    }

    const rows = await tx
      .select()
      .from(channels)
      .where(and(...conditions))
      .orderBy(channels.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toChannelResult);
  });
}

export async function getChannel(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  auth: AuthContext,
): Promise<ChannelResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    return toChannelResult(row);
  });
}
