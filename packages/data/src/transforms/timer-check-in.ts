import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CheckInRecord,
  CheckInRecordId,
  MemberId,
  SystemId,
  TimerConfig,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";

export interface TimerConfigEncryptedFields {
  readonly promptText: string;
}

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `timerConfig.get` — derived from the `TimerConfig` domain type. */
export type TimerConfigRaw = Omit<TimerConfig, keyof TimerConfigEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `timerConfig.list`. */
export interface TimerConfigPage {
  readonly data: readonly TimerConfigRaw[];
  readonly nextCursor: string | null;
}

/** Wire shape for a single check-in record. */
export interface CheckInRecordRaw {
  readonly id: CheckInRecordId;
  readonly timerConfigId: TimerId;
  readonly systemId: SystemId;
  readonly scheduledAt: UnixMillis;
  readonly respondedByMemberId: MemberId | null;
  readonly respondedAt: UnixMillis | null;
  readonly dismissed: boolean;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

/** Shape returned by `checkInRecord.list`. */
export interface CheckInRecordPage {
  readonly data: readonly CheckInRecordRaw[];
  readonly nextCursor: string | null;
}

// ── Validator ─────────────────────────────────────────────────────────

function assertTimerConfigEncryptedFields(raw: unknown): asserts raw is TimerConfigEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted timer config blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["promptText"] !== "string") {
    throw new Error("Decrypted timer config blob missing required string field: promptText");
  }
}

// ── Timer config transforms ──────────────────────────────────────────

export function decryptTimerConfig(
  raw: TimerConfigRaw,
  masterKey: KdfMasterKey,
): TimerConfig | Archived<TimerConfig> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertTimerConfigEncryptedFields(decrypted);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    intervalMinutes: raw.intervalMinutes,
    wakingHoursOnly: raw.wakingHoursOnly,
    wakingStart: raw.wakingStart,
    wakingEnd: raw.wakingEnd,
    promptText: decrypted.promptText,
    enabled: raw.enabled,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    version: raw.version,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived timer config missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

export function decryptTimerConfigPage(
  raw: TimerConfigPage,
  masterKey: KdfMasterKey,
): { data: (TimerConfig | Archived<TimerConfig>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptTimerConfig(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptTimerConfigInput(
  data: TimerConfigEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptTimerConfigUpdate(
  data: TimerConfigEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

export function decryptCheckInRecord(
  raw: CheckInRecordRaw,
): CheckInRecord | Archived<CheckInRecord> {
  const base = {
    id: raw.id,
    timerConfigId: raw.timerConfigId,
    systemId: raw.systemId,
    scheduledAt: raw.scheduledAt,
    respondedByMemberId: raw.respondedByMemberId,
    respondedAt: raw.respondedAt,
    dismissed: raw.dismissed,
    archivedAt: raw.archivedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived check-in record missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const, archivedAt: raw.archivedAt };
}

export function decryptCheckInRecordPage(raw: CheckInRecordPage): {
  data: (CheckInRecord | Archived<CheckInRecord>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptCheckInRecord(item)),
    nextCursor: raw.nextCursor,
  };
}
