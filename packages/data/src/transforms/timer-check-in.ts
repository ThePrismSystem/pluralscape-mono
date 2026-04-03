import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
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
  readonly archived: false;
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

export function decryptTimerConfig(raw: RawTimerConfig, masterKey: KdfMasterKey): TimerConfig {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertTimerConfigEncryptedFields(decrypted);
  return {
    id: raw.id,
    systemId: raw.systemId,
    intervalMinutes: raw.intervalMinutes,
    wakingHoursOnly: raw.wakingHoursOnly,
    wakingStart: raw.wakingStart,
    wakingEnd: raw.wakingEnd,
    promptText: decrypted.promptText,
    enabled: raw.enabled,
    archived: false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    version: raw.version,
  };
}

export function decryptTimerConfigPage(
  raw: RawTimerConfigList,
  masterKey: KdfMasterKey,
): { items: TimerConfig[]; nextCursor: string | null } {
  return {
    items: raw.data.map((item) => decryptTimerConfig(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptTimerConfigInput(
  data: TimerConfigEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

export function encryptTimerConfigUpdate(
  data: TimerConfigEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}

export function decryptCheckInRecord(raw: RawCheckInRecord): CheckInRecord {
  return {
    id: raw.id,
    timerConfigId: raw.timerConfigId,
    systemId: raw.systemId,
    scheduledAt: raw.scheduledAt,
    respondedByMemberId: raw.respondedByMemberId,
    respondedAt: raw.respondedAt,
    dismissed: raw.dismissed,
    archived: false,
    archivedAt: raw.archivedAt,
  };
}

export function decryptCheckInRecordPage(raw: RawCheckInRecordList): {
  items: CheckInRecord[];
  nextCursor: string | null;
} {
  return {
    items: raw.data.map((item) => decryptCheckInRecord(item)),
    nextCursor: raw.nextCursor,
  };
}
