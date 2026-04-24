import { auditLog } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, gt, like, lt, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withAccountRead } from "../lib/rls-context.js";

import type { DbAuditActor } from "@pluralscape/db/pg";
import type {
  AccountId,
  ApiKeyId,
  AuditActor,
  AuditEventType,
  AuditLogEntryId,
  PaginatedResult,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

/**
 * Shape returned by `queryAuditLog`. Mirrors the domain `AuditLogEntry`
 * (and the OpenAPI `AuditLogEntry` schema) so the route response conforms
 * to the plaintext-wire parity contract enforced in
 * `scripts/openapi-wire-parity.type-test.ts`.
 *
 * Note: the DB column is `timestamp` (event-occurred time); the domain /
 * wire field is `createdAt`. The mapping in `toEntryResult` handles the
 * rename.
 */
export interface AuditLogEntryResult {
  readonly id: AuditLogEntryId;
  readonly systemId: SystemId;
  readonly eventType: AuditEventType;
  readonly createdAt: UnixMillis;
  readonly actor: AuditActor;
  readonly detail: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface AuditLogQueryParams {
  readonly eventType?: string;
  readonly resourceType?: string;
  readonly from: UnixMillis;
  readonly to: UnixMillis;
  readonly cursor?: string;
  readonly limit: number;
}

// ── Cursor encoding ────────────────────────────────────────────────

interface CursorData {
  readonly t: UnixMillis;
  readonly i: AuditLogEntryId;
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
      typeof (parsed as { t: unknown }).t === "number" &&
      (parsed as { t: number }).t > 0 &&
      typeof (parsed as { i: unknown }).i === "string" &&
      (parsed as { i: string }).i.length > 0
    ) {
      const raw = parsed as { t: number; i: string };
      return { t: toUnixMillis(raw.t), i: brandId<AuditLogEntryId>(raw.i) };
    }
  } catch {
    // fall through
  }
  throw new ApiHttpError(HTTP_BAD_REQUEST, "INVALID_CURSOR", "Malformed pagination cursor");
}

// ── Query ──────────────────────────────────────────────────────────

function brandDbActor(actor: DbAuditActor): AuditActor {
  switch (actor.kind) {
    case "account":
      return { kind: "account", id: brandId<AccountId>(actor.id) };
    case "api-key":
      return { kind: "api-key", id: brandId<ApiKeyId>(actor.id) };
    case "system":
      return { kind: "system", id: brandId<SystemId>(actor.id) };
  }
}

function toEntryResult(row: typeof auditLog.$inferSelect): AuditLogEntryResult {
  return {
    id: brandId<AuditLogEntryId>(row.id),
    // systemId is nullable in the DB (audit rows survive system deletion
    // via ON DELETE SET NULL). Rows returned to a signed-in account have
    // a concrete systemId; the `??` brand cast keeps the type contract
    // honest without forcing an extra filter in the SQL layer.
    systemId: brandId<SystemId>(row.systemId ?? ""),
    eventType: row.eventType,
    createdAt: toUnixMillis(row.timestamp),
    actor: brandDbActor(row.actor),
    detail: row.detail,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
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
