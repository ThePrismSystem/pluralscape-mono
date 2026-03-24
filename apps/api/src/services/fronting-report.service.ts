import { frontingReports } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, toUnixMillis } from "@pluralscape/types";
import { CreateFrontingReportBodySchema } from "@pluralscape/validation";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  FrontingReportId,
  PaginatedResult,
  ReportFormat,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ────────────────────────────────────────────────────────────

export interface FrontingReportResult {
  readonly id: FrontingReportId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly format: ReportFormat;
  readonly generatedAt: UnixMillis;
}

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

// ── Helpers ──────────────────────────────────────────────────────────

function toFrontingReportResult(row: {
  id: string;
  systemId: string;
  encryptedData: { tier: number; algorithm: string; nonce: Uint8Array; ciphertext: Uint8Array };
  format: string;
  generatedAt: number;
}): FrontingReportResult {
  return {
    id: row.id as FrontingReportId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(
      row.encryptedData as Parameters<typeof encryptedBlobToBase64>[0],
    ),
    format: row.format as ReportFormat,
    generatedAt: toUnixMillis(row.generatedAt),
  };
}

// ── CREATE ───────────────────────────────────────────────────────────

export async function createFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FrontingReportResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateFrontingReportBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const reportId = createId(ID_PREFIXES.frontingReport);

  return withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [row] = await tx
      .insert(frontingReports)
      .values({
        id: reportId,
        systemId,
        encryptedData: blob,
        format: parsed.format,
        generatedAt: parsed.generatedAt,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create fronting report — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "fronting-report.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting report created",
      systemId,
    });

    return toFrontingReportResult(row);
  });
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

  return withTenantRead(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const conditions = [eq(frontingReports.systemId, systemId)];

    if (opts.cursor) {
      const cursor = decodeCursor(opts.cursor);
      const cursorCondition = or(
        lt(frontingReports.generatedAt, cursor.t),
        and(eq(frontingReports.generatedAt, cursor.t), lt(frontingReports.id, cursor.i)),
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
      items,
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

  return withTenantRead(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [row] = await tx
      .select()
      .from(frontingReports)
      .where(and(eq(frontingReports.id, reportId), eq(frontingReports.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting report not found");
    }

    return toFrontingReportResult(row);
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteFrontingReport(
  db: PostgresJsDatabase,
  systemId: SystemId,
  reportId: FrontingReportId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, { systemId, accountId: auth.accountId }, async (tx) => {
    const [existing] = await tx
      .select({ id: frontingReports.id })
      .from(frontingReports)
      .where(and(eq(frontingReports.id, reportId), eq(frontingReports.systemId, systemId)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Fronting report not found");
    }

    await audit(tx, {
      eventType: "fronting-report.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Fronting report deleted",
      systemId,
    });

    await tx
      .delete(frontingReports)
      .where(and(eq(frontingReports.id, reportId), eq(frontingReports.systemId, systemId)));
  });
}
