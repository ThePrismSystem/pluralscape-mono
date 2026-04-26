import { brandId, toUnixMillis } from "@pluralscape/types";
import { TimerConfigEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CheckInRecord,
  CheckInRecordId,
  MemberId,
  SystemId,
  TimerConfig,
  TimerConfigEncryptedInput,
  TimerConfigWire,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";

/**
 * Server-emitted wire shape for a TimerConfig — derived from `TimerConfigWire`
 * by stripping `nextCheckInAt`, which is computed server-side and not
 * surfaced through the API output (the canonical type carries it because
 * Drizzle parity holds for the row, not the wire).
 */
export type TimerConfigServerWire = Omit<TimerConfigWire, "nextCheckInAt">;

/** Shape returned by `timerConfig.list`. */
export interface TimerConfigPage {
  readonly data: readonly TimerConfigServerWire[];
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

// ── Timer config transforms ──────────────────────────────────────────

export function decryptTimerConfig(
  raw: TimerConfigServerWire,
  masterKey: KdfMasterKey,
): TimerConfig | Archived<TimerConfig> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = TimerConfigEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<TimerId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    intervalMinutes: raw.intervalMinutes,
    wakingHoursOnly: raw.wakingHoursOnly,
    wakingStart: raw.wakingStart,
    wakingEnd: raw.wakingEnd,
    promptText: validated.promptText,
    enabled: raw.enabled,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
    version: raw.version,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived timer config missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
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
  data: TimerConfigEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptTimerConfigUpdate(
  data: TimerConfigEncryptedInput,
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
