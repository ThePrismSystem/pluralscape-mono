import { timerConfigs } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { TimerConfigQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildPaginatedResult } from "../../lib/pagination.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toTimerConfigResult } from "./internal.js";

import type { TimerConfigListOptions, TimerConfigResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { PaginatedResult, SystemId, TimerId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function listTimerConfigs(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: TimerConfigListOptions = {},
): Promise<PaginatedResult<TimerConfigResult>> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    const conditions = [eq(timerConfigs.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(timerConfigs.archived, false));
    }

    if (opts.cursor) {
      conditions.push(lt(timerConfigs.id, brandId<TimerId>(opts.cursor)));
    }

    const rows = await tx
      .select()
      .from(timerConfigs)
      .where(and(...conditions))
      .orderBy(desc(timerConfigs.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toTimerConfigResult);
  });
}

export async function getTimerConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  timerId: TimerId,
  auth: AuthContext,
): Promise<TimerConfigResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(timerConfigs)
      .where(
        and(
          eq(timerConfigs.id, timerId),
          eq(timerConfigs.systemId, systemId),
          eq(timerConfigs.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Timer config not found");
    }

    return toTimerConfigResult(row);
  });
}

export function parseTimerConfigQuery(
  query: Record<string, string | undefined>,
): TimerConfigListOptions {
  const result = TimerConfigQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
