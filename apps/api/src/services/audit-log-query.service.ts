import { auditLog } from "@pluralscape/db/pg";
import { toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, gt, like, lt, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withAccountRead } from "../lib/rls-context.js";

import type {
  AccountId,
  AuditEventType,
  AuditLogEntryId,
  PaginatedResult,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface AuditLogEntryResult {
  readonly id: AuditLogEntryId;
  readonly eventType: string;
  readonly timestamp: UnixMillis;
  readonly actor: unknown;
  readonly detail: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly systemId: string | null;
}

export interface AuditLogQueryParams {
  readonly eventType?: string;
  readonly resourceType?: string;
  readonly from: number;
  readonly to: number;
  readonly cursor?: string;
  readonly limit: number;
}

// ── Cursor encoding ────────────────────────────────────────────────

interface CursorData {
  readonly t: number;
  readonly i: string;
}

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

function decodeCursor(cursor: string): CursorData {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "t" in parsed &&
      "i" in parsed &&
      typeof (parsed as CursorData).t === "number" &&
      (parsed as CursorData).t > 0 &&
      typeof (parsed as CursorData).i === "string" &&
      (parsed as CursorData).i.length > 0
    ) {
      return parsed as CursorData;
    }
  } catch {
    // fall through
  }
  throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed pagination cursor");
}

// ── Query ──────────────────────────────────────────────────────────

function toEntryResult(row: typeof auditLog.$inferSelect): AuditLogEntryResult {
  return {
    id: row.id as AuditLogEntryId,
    eventType: row.eventType,
    timestamp: toUnixMillis(row.timestamp),
    actor: row.actor,
    detail: row.detail,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    systemId: row.systemId,
  };
}

export async function queryAuditLog(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: AuditLogQueryParams,
): Promise<PaginatedResult<AuditLogEntryResult>> {
  const conditions = [
    eq(auditLog.accountId, accountId),
    gt(auditLog.timestamp, params.from),
    lt(auditLog.timestamp, params.to),
  ];

  if (params.eventType) {
    conditions.push(eq(auditLog.eventType, params.eventType as AuditEventType));
  }

  if (params.resourceType) {
    conditions.push(like(auditLog.eventType, `${params.resourceType}.%`));
  }

  if (params.cursor) {
    const cursor = decodeCursor(params.cursor);
    const cursorCondition = or(
      lt(auditLog.timestamp, cursor.t),
      and(eq(auditLog.timestamp, cursor.t), lt(auditLog.id, cursor.i)),
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  return withAccountRead(db, accountId, async (tx) => {
    const rows = await tx
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.timestamp), desc(auditLog.id))
      .limit(params.limit + 1);

    const hasMore = rows.length > params.limit;
    const items = hasMore ? rows.slice(0, params.limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      data: items.map(toEntryResult),
      nextCursor:
        hasMore && lastItem
          ? (encodeCursor({
              t: lastItem.timestamp,
              i: lastItem.id,
            }) as PaginatedResult<AuditLogEntryResult>["nextCursor"])
          : null,
      hasMore,
      totalCount: null,
    };
  });
}
