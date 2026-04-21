import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  SystemId,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────

interface TimerConfigBase {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly enabled: boolean;
  readonly intervalMinutes: number | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export type TimerConfigResult = TimerConfigBase &
  (
    | {
        readonly wakingHoursOnly: true;
        readonly wakingStart: string;
        readonly wakingEnd: string;
      }
    | {
        readonly wakingHoursOnly: false | null;
        readonly wakingStart: string | null;
        readonly wakingEnd: string | null;
      }
  );

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
