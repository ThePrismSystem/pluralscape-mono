import { buckets } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { BucketQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toBucketResult } from "./internal.js";

import type { BucketResult, ListBucketOpts } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { BucketId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listBuckets(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListBucketOpts = {},
): Promise<PaginatedResult<BucketResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(buckets.systemId, systemId)];

    if (opts.archivedOnly) {
      // archivedOnly takes precedence: show only archived buckets
      conditions.push(eq(buckets.archived, true));
    } else if (!opts.includeArchived) {
      conditions.push(eq(buckets.archived, false));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "bucket");
      const sortValue = toUnixMillis(decoded.sortValue);
      const cursorCondition = or(
        lt(buckets.createdAt, sortValue),
        and(eq(buckets.createdAt, sortValue), lt(buckets.id, brandId<BucketId>(decoded.id))),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(buckets)
      .where(and(...conditions))
      .orderBy(desc(buckets.createdAt), desc(buckets.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toBucketResult, (i) => i.createdAt);
  });
}

export function parseBucketQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  archivedOnly: boolean;
} {
  return parseQuery(BucketQuerySchema, query);
}
