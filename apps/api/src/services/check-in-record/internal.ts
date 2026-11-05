import { checkInRecords } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { encryptedBlobToBase64OrNull } from "../../lib/encrypted-blob.js";

import type {
  CheckInRecordResult,
  CheckInRecordId,
  EncryptedBlob,
  MemberId,
  SystemId,
  TimerId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────

export interface CheckInRecordListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly timerConfigId?: TimerId;
  readonly pending?: boolean;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

export function toCheckInRecordResult(row: {
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
    id: brandId<CheckInRecordId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    timerConfigId: brandId<TimerId>(row.timerConfigId),
    scheduledAt: toUnixMillis(row.scheduledAt),
    respondedByMemberId:
      row.respondedByMemberId === null ? null : brandId<MemberId>(row.respondedByMemberId),
    respondedAt: toUnixMillisOrNull(row.respondedAt),
    dismissed: row.dismissed,
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}

// ── State guards ────────────────────────────────────────────────

export async function fetchPendingCheckIn(
  tx: PostgresJsDatabase,
  recordId: CheckInRecordId,
  systemId: SystemId,
): Promise<typeof checkInRecords.$inferSelect> {
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

  return current;
}
