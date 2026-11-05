import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { TimerConfigResult, EncryptedBlob, SystemId, TimerId } from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────

type TimerConfigBase = Omit<TimerConfigResult, "wakingHoursOnly" | "wakingStart" | "wakingEnd">;

export interface TimerConfigListOptions {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────

export function toTimerConfigResult(row: {
  id: string;
  systemId: string;
  enabled: boolean;
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: string | null;
  wakingEnd: string | null;
  nextCheckInAt: number | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): TimerConfigResult {
  const base: TimerConfigBase = {
    id: brandId<TimerId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    enabled: row.enabled,
    intervalMinutes: row.intervalMinutes,
    nextCheckInAt: toUnixMillisOrNull(row.nextCheckInAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };

  if (row.wakingHoursOnly === true && row.wakingStart !== null && row.wakingEnd !== null) {
    return {
      ...base,
      wakingHoursOnly: true,
      wakingStart: row.wakingStart,
      wakingEnd: row.wakingEnd,
    };
  }

  return {
    ...base,
    wakingHoursOnly: row.wakingHoursOnly === true ? false : row.wakingHoursOnly,
    wakingStart: row.wakingStart,
    wakingEnd: row.wakingEnd,
  };
}
