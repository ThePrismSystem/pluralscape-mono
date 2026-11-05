import { lifecycleEvents } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type {
  LifecycleEventResult,
  EncryptedBlob,
  LifecycleEventId,
  LifecycleEventType,
  SystemId,
} from "@pluralscape/types";
import type { PlaintextMetadata } from "@pluralscape/validation";

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
