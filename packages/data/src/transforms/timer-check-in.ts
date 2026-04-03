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

interface RawTimerConfig {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number | null;
  readonly wakingHoursOnly: boolean | null;
  readonly wakingStart: string | null;
  readonly wakingEnd: string | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface RawTimerConfigList {
  readonly data: readonly RawTimerConfig[];
  readonly nextCursor: string | null;
}

interface RawCheckInRecord {
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

interface RawCheckInRecordList {
  readonly data: readonly RawCheckInRecord[];
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
  raw: RawTimerConfig,
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
  raw: RawTimerConfigList,
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
  raw: RawCheckInRecord,
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

export function decryptCheckInRecordPage(raw: RawCheckInRecordList): {
  data: (CheckInRecord | Archived<CheckInRecord>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map((item) => decryptCheckInRecord(item)),
    nextCursor: raw.nextCursor,
  };
}
