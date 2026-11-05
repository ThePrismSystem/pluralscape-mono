import { systemStructureEntities } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  SystemStructureEntityResult,
  EncryptedBlob,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";

// ── Row mapper ────────────────────────────────────────────────────

export function toStructureEntityResult(row: {
  id: string;
  systemId: string;
  entityTypeId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): SystemStructureEntityResult {
  return {
    id: brandId<SystemStructureEntityId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    entityTypeId: brandId<SystemStructureEntityTypeId>(row.entityTypeId),
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── Entity lifecycle config ────────────────────────────────────────

export const ENTITY_LIFECYCLE = {
  table: systemStructureEntities,
  columns: systemStructureEntities,
  entityName: "Structure entity",
  archiveEvent: "structure-entity.archived" as const,
  restoreEvent: "structure-entity.restored" as const,
};
