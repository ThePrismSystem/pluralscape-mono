import { lifecycleEvents } from "@pluralscape/db/pg";
import { and, eq, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toLifecycleEventResult } from "./internal.js";

import type { LifecycleEventResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { LifecycleEventId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface LifecycleEventCursor {
  readonly occurredAt: number;
  readonly id: string;
}

export interface PaginatedLifecycleEvents {
  readonly data: readonly LifecycleEventResult[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly totalCount: null;
}

function encodeCursor(occurredAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt, id })).toString("base64");
}

function decodeCursor(cursor: string): LifecycleEventCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "occurredAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as LifecycleEventCursor).occurredAt === "number" &&
      typeof (parsed as LifecycleEventCursor).id === "string"
    ) {
      return parsed as LifecycleEventCursor;
    }
  } catch {
    // fall through
  }
  throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Invalid cursor format");
}

export async function listLifecycleEvents(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  eventType?: string,
  includeArchived = false,
): Promise<PaginatedLifecycleEvents> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(lifecycleEvents.systemId, systemId)];

    if (!includeArchived) {
      conditions.push(eq(lifecycleEvents.archived, false));
    }

    if (eventType) {
      conditions.push(sql`${lifecycleEvents.eventType} = ${eventType}`);
    }

    if (cursor) {
      const parsed = decodeCursor(cursor);
      conditions.push(
        sql`(${lifecycleEvents.occurredAt} < ${parsed.occurredAt} OR (${lifecycleEvents.occurredAt} = ${parsed.occurredAt} AND ${lifecycleEvents.id} < ${parsed.id}))`,
      );
    }

    const rows = await tx
      .select()
      .from(lifecycleEvents)
      .where(and(...conditions))
      .orderBy(sql`${lifecycleEvents.occurredAt} DESC, ${lifecycleEvents.id} DESC`)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toLifecycleEventResult);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.occurredAt, lastItem.id) : null;

    return {
      data: items,
      nextCursor,
      hasMore,
      totalCount: null,
    };
  });
}

export async function getLifecycleEvent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  eventId: LifecycleEventId,
  auth: AuthContext,
): Promise<LifecycleEventResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(lifecycleEvents)
      .where(and(eq(lifecycleEvents.id, eventId), eq(lifecycleEvents.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Lifecycle event not found");
    }

    return toLifecycleEventResult(row);
  });
}
