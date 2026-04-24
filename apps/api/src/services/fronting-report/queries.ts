import { frontingReports } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toFrontingReportResult } from "./internal.js";

import type { FrontingReportResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingReportId, PaginatedResult, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface FrontingReportListOptions {
  readonly cursor?: string;
  readonly limit?: number;
}

// ── Cursor ───────────────────────────────────────────────────────────

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
      (parsed as CursorData).t >= 0 &&
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

// ── LIST ─────────────────────────────────────────────────────────────

export async function listFrontingReports(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: FrontingReportListOptions = {},
): Promise<PaginatedResult<FrontingReportResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(frontingReports.systemId, systemId)];

    if (opts.cursor) {
      const cursor = decodeCursor(opts.cursor);
      const cursorCondition = or(
        lt(frontingReports.generatedAt, cursor.t),
        and(
          eq(frontingReports.generatedAt, cursor.t),
          lt(frontingReports.id, brandId<FrontingReportId>(cursor.i)),
        ),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    const rows = await tx
      .select()
      .from(frontingReports)
      .where(and(...conditions))
      .orderBy(desc(frontingReports.generatedAt), desc(frontingReports.id))
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toFrontingReportResult);
    const lastItem = hasMore && items.length > 0 ? items[items.length - 1] : null;

    return {
      data: items,
      nextCursor:
        hasMore && lastItem
          ? (encodeCursor({
              t: lastItem.generatedAt as number,
              i: lastItem.id,
            }) as PaginatedResult<FrontingReportResult>["nextCursor"])
          : null,
      hasMore,
      totalCount: null,
    };
  });
}

// ── GET ──────────────────────────────────────────────────────────────

export async function getFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  auth: AuthContext,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(frontingReports)
      .where(
        and(
          eq(frontingReports.id, reportId),
          eq(frontingReports.systemId, systemId),
          eq(frontingReports.archived, false),
        ),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting report not found");
    }

    return toFrontingReportResult(row);
  });
}
