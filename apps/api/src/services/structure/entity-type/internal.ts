import { systemStructureEntityTypes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  SystemId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";

export interface EntityTypeResult {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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
