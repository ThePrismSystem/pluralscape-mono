import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  InnerWorldEntityId,
  InnerWorldEntityServerMetadata,
  InnerWorldRegionId,
  SystemId,
} from "@pluralscape/types";

export type EntityResult = EncryptedWire<InnerWorldEntityServerMetadata>;

export function toEntityResult(row: {
  id: string;
  systemId: string;
  regionId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): EntityResult {
  return {
    id: brandId<InnerWorldEntityId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    regionId: row.regionId ? brandId<InnerWorldRegionId>(row.regionId) : null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
