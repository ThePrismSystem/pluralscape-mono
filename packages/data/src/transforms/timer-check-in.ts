import { brandId, toUnixMillis } from "@pluralscape/types";
import { TimerConfigEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CheckInRecord,
  CheckInRecordId,
  CheckInRecordWire,
  MemberId,
  SystemId,
  TimerConfig,
  TimerConfigEncryptedInput,
  TimerConfigWire,
  TimerId,
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

/** Shape returned by `checkInRecord.list`. */
export interface CheckInRecordPage {
  readonly data: readonly CheckInRecordWire[];
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
  raw: CheckInRecordWire,
): CheckInRecord | Archived<CheckInRecord> {
  const respondedByMemberId =
    raw.respondedByMemberId === null ? null : brandId<MemberId>(raw.respondedByMemberId);
  const respondedAt = raw.respondedAt === null ? null : toUnixMillis(raw.respondedAt);
  const archivedAt = raw.archivedAt === null ? null : toUnixMillis(raw.archivedAt);

  const base = {
    id: brandId<CheckInRecordId>(raw.id),
    timerConfigId: brandId<TimerId>(raw.timerConfigId),
    systemId: brandId<SystemId>(raw.systemId),
    scheduledAt: toUnixMillis(raw.scheduledAt),
    respondedByMemberId,
    respondedAt,
    dismissed: raw.dismissed,
    archivedAt,
  };

  if (raw.archived) {
    if (archivedAt === null) throw new Error("Archived check-in record missing archivedAt");
    return { ...base, archived: true as const, archivedAt };
  }
  return { ...base, archived: false as const, archivedAt };
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
