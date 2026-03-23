import { checkInRecords, members } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  CheckInRecordQuerySchema,
  CreateCheckInRecordBodySchema,
  RespondCheckInRecordBodySchema,
} from "@pluralscape/validation";
import { and, desc, eq, isNull, lt } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64OrNull, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  CheckInRecordId,
  EncryptedBlob,
  MemberId,
  PaginatedResult,
  SystemId,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────

export interface CheckInRecordResult {
  readonly id: CheckInRecordId;
  readonly systemId: SystemId;
  readonly timerConfigId: TimerId;
  readonly scheduledAt: UnixMillis;
  readonly respondedByMemberId: MemberId | null;
  readonly respondedAt: UnixMillis | null;
  readonly dismissed: boolean;
  readonly encryptedData: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

export interface CheckInRecordListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly timerConfigId?: TimerId;
  readonly pending?: boolean;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

function toCheckInRecordResult(row: {
  id: string;
  systemId: string;
  timerConfigId: string;
  scheduledAt: number;
  respondedByMemberId: string | null;
  respondedAt: number | null;
  dismissed: boolean;
  encryptedData: EncryptedBlob | null;
  archived: boolean;
  archivedAt: number | null;
}): CheckInRecordResult {
  return {
    id: row.id as CheckInRecordId,
    systemId: row.systemId as SystemId,
    timerConfigId: row.timerConfigId as TimerId,
    scheduledAt: toUnixMillis(row.scheduledAt),
    respondedByMemberId: row.respondedByMemberId as MemberId | null,
    respondedAt: toUnixMillisOrNull(row.respondedAt),
    dismissed: row.dismissed,
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────

export async function createCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  const result = CreateCheckInRecordBodySchema.safeParse(params);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const parsed = result.data;

  const blob = parsed.encryptedData
    ? validateEncryptedBlob(parsed.encryptedData, MAX_ENCRYPTED_DATA_BYTES)
    : null;

  const recordId = createId(ID_PREFIXES.checkInRecord);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(checkInRecords)
      .values({
        id: recordId,
        systemId,
        timerConfigId: parsed.timerConfigId,
        scheduledAt: parsed.scheduledAt,
        encryptedData: blob,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create check-in record — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "check-in-record.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record created",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────

export async function listCheckInRecords(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: CheckInRecordListOptions = {},
): Promise<PaginatedResult<CheckInRecordResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const conditions = [eq(checkInRecords.systemId, systemId)];

  if (!opts.includeArchived) {
    conditions.push(eq(checkInRecords.archived, false));
  }

  if (opts.timerConfigId) {
    conditions.push(eq(checkInRecords.timerConfigId, opts.timerConfigId));
  }

  if (opts.pending) {
    conditions.push(isNull(checkInRecords.respondedAt));
    conditions.push(eq(checkInRecords.dismissed, false));
    conditions.push(eq(checkInRecords.archived, false));
  }

  if (opts.cursor) {
    conditions.push(lt(checkInRecords.id, opts.cursor));
  }

  const rows = await db
    .select()
    .from(checkInRecords)
    .where(and(...conditions))
    .orderBy(desc(checkInRecords.id))
    .limit(effectiveLimit + 1);

  return buildPaginatedResult(rows, effectiveLimit, toCheckInRecordResult);
}

// ── GET ─────────────────────────────────────────────────────────

export async function getCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select()
    .from(checkInRecords)
    .where(
      and(
        eq(checkInRecords.id, recordId),
        eq(checkInRecords.systemId, systemId),
        eq(checkInRecords.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
  }

  return toCheckInRecordResult(row);
}

// ── RESPOND ─────────────────────────────────────────────────────

export async function respondCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  const parseResult = RespondCheckInRecordBodySchema.safeParse(params);
  if (!parseResult.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid payload");
  }
  const { respondedByMemberId } = parseResult.data;
  const timestamp = now();

  return db.transaction(async (tx) => {
    // Fetch current state
    const [current] = await tx
      .select()
      .from(checkInRecords)
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    if (current.respondedAt !== null) {
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_RESPONDED", "Check-in already responded");
    }

    if (current.dismissed) {
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_DISMISSED", "Check-in already dismissed");
    }

    // Validate member exists in this system
    const [member] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, respondedByMemberId), eq(members.systemId, systemId)))
      .limit(1);

    if (!member) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Member not found in system");
    }

    const [row] = await tx
      .update(checkInRecords)
      .set({
        respondedByMemberId,
        respondedAt: timestamp,
      })
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
      .returning();

    if (!row) {
      throw new Error("Failed to update check-in record — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "check-in-record.responded",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record responded",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}

// ── DISMISS ─────────────────────────────────────────────────────

export async function dismissCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CheckInRecordResult> {
  assertSystemOwnership(systemId, auth);

  return db.transaction(async (tx) => {
    // Fetch current state
    const [current] = await tx
      .select()
      .from(checkInRecords)
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
      .limit(1);

    if (!current) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    if (current.respondedAt !== null) {
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_RESPONDED", "Check-in already responded");
    }

    if (current.dismissed) {
      throw new ApiHttpError(HTTP_CONFLICT, "ALREADY_DISMISSED", "Check-in already dismissed");
    }

    const [row] = await tx
      .update(checkInRecords)
      .set({ dismissed: true })
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
      .returning();

    if (!row) {
      throw new Error("Failed to update check-in record — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "check-in-record.dismissed",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record dismissed",
      systemId,
    });

    return toCheckInRecordResult(row);
  });
}

// ── ARCHIVE ─────────────────────────────────────────────────────

export async function archiveCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const timestamp = now();

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(checkInRecords)
      .set({
        archived: true,
        archivedAt: timestamp,
      })
      .where(
        and(
          eq(checkInRecords.id, recordId),
          eq(checkInRecords.systemId, systemId),
          eq(checkInRecords.archived, false),
        ),
      )
      .returning({ id: checkInRecords.id });

    if (updated.length === 0) {
      const [existing] = await tx
        .select({ id: checkInRecords.id })
        .from(checkInRecords)
        .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
        .limit(1);

      if (existing) {
        throw new ApiHttpError(
          HTTP_CONFLICT,
          "ALREADY_ARCHIVED",
          "Check-in record is already archived",
        );
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    await audit(tx, {
      eventType: "check-in-record.archived",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record archived",
      systemId,
    });
  });
}

// ── DELETE ───────────────────────────────────────────────────────

export async function deleteCheckInRecord(
  db: PostgresJsDatabase,
  systemId: SystemId,
  recordId: CheckInRecordId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: checkInRecords.id })
      .from(checkInRecords)
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Check-in record not found");
    }

    await tx
      .delete(checkInRecords)
      .where(and(eq(checkInRecords.id, recordId), eq(checkInRecords.systemId, systemId)));

    await audit(tx, {
      eventType: "check-in-record.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Check-in record deleted",
      systemId,
    });
  });
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────

export function parseCheckInRecordQuery(
  query: Record<string, string | undefined>,
): CheckInRecordListOptions {
  const result = CheckInRecordQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters");
  }
  return result.data;
}
