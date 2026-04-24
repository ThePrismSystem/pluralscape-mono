import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  SystemId,
  SystemStructureEntityTypeId,
  SystemStructureEntityTypeServerMetadata,
} from "@pluralscape/types";

export type EntityTypeResult = EncryptedWire<SystemStructureEntityTypeServerMetadata>;

export function toEntityTypeResult(row: {
  id: string;
  systemId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): EntityTypeResult {
  return {
    id: brandId<SystemStructureEntityTypeId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

export const ENTITY_TYPE_LIFECYCLE = {
  table: systemStructureEntityTypes,
  columns: systemStructureEntityTypes,
  entityName: "Structure entity type",
  archiveEvent: "structure-entity-type.archived" as const,
  restoreEvent: "structure-entity-type.restored" as const,
};
