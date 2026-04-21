import { checkInRecords } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { encryptedBlobToBase64OrNull } from "../../lib/encrypted-blob.js";

import type {
  CheckInRecordId,
  EncryptedBlob,
  MemberId,
  SystemId,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────

interface CheckInRecordBase {
  readonly id: CheckInRecordId;
  readonly systemId: SystemId;
  readonly timerConfigId: TimerId;
  readonly scheduledAt: UnixMillis;
  readonly encryptedData: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

export type CheckInRecordResult = CheckInRecordBase &
  (
    | {
        readonly status: "pending";
        readonly respondedByMemberId: null;
        readonly respondedAt: null;
        readonly dismissed: false;
      }
    | {
        readonly status: "responded";
        readonly respondedByMemberId: MemberId;
        readonly respondedAt: UnixMillis;
        readonly dismissed: false;
      }
    | {
        readonly status: "dismissed";
        readonly respondedByMemberId: null;
        readonly respondedAt: null;
        readonly dismissed: true;
      }
  );

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
  const base: CheckInRecordBase = {
    id: brandId<CheckInRecordId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    timerConfigId: brandId<TimerId>(row.timerConfigId),
    scheduledAt: toUnixMillis(row.scheduledAt),
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };

  if (row.respondedAt !== null && row.respondedByMemberId !== null) {
    return {
      ...base,
      status: "responded",
      respondedByMemberId: brandId<MemberId>(row.respondedByMemberId),
      respondedAt: toUnixMillis(row.respondedAt),
      dismissed: false,
    };
  }

  if (row.dismissed) {
    return {
      ...base,
      status: "dismissed",
      respondedByMemberId: null,
      respondedAt: null,
      dismissed: true,
    };
  }

  return {
    ...base,
    status: "pending",
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
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
