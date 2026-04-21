import { lifecycleEvents } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { PlaintextMetadata } from "@pluralscape/validation";
import type {
  EncryptedBlob,
  LifecycleEventId,
  LifecycleEventType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface LifecycleEventResult {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly encryptedData: string;
  readonly plaintextMetadata: PlaintextMetadata | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly updatedAt: UnixMillis;
}

export function toLifecycleEventResult(row: {
  id: string;
  systemId: string;
  eventType: LifecycleEventType;
  occurredAt: number;
  recordedAt: number;
  updatedAt: number;
  encryptedData: EncryptedBlob;
  plaintextMetadata?: PlaintextMetadata | null;
  version: number;
  archived: boolean;
  archivedAt: number | null;
}): LifecycleEventResult {
  return {
    id: brandId<LifecycleEventId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    eventType: row.eventType,
    occurredAt: toUnixMillis(row.occurredAt),
    recordedAt: toUnixMillis(row.recordedAt),
    updatedAt: toUnixMillis(row.updatedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    plaintextMetadata: row.plaintextMetadata ?? null,
    version: row.version,
    archived: row.archived,
    archivedAt: row.archivedAt !== null ? toUnixMillis(row.archivedAt) : null,
  };
}

export const LIFECYCLE_EVENT_LIFECYCLE: ArchivableEntityConfig<LifecycleEventId> = {
  table: lifecycleEvents,
  columns: lifecycleEvents,
  entityName: "Lifecycle event",
  archiveEvent: "lifecycle-event.archived",
  restoreEvent: "lifecycle-event.restored",
};
