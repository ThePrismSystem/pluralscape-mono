import { systems } from "@pluralscape/db/pg";
import { and, eq, gt } from "drizzle-orm";

import { buildPaginatedResult } from "../../lib/pagination.js";
import { withAccountRead } from "../../lib/rls-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toSystemProfileResult } from "./internal.js";

import type { SystemProfileResult } from "./internal.js";
import type { AccountId, PaginatedResult } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listSystems(
  db: PostgresJsDatabase,
  accountId: AccountId,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<SystemProfileResult>> {
  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const conditions = [eq(systems.accountId, accountId), eq(systems.archived, false)];

    if (cursor) {
      conditions.push(gt(systems.id, cursor));
    }

    const rows = await tx
      .select()
      .from(systems)
      .where(and(...conditions))
      .orderBy(systems.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toSystemProfileResult);
  });
}
