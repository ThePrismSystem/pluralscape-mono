import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  CustomFrontId,
  CustomFrontServerMetadata,
  EncryptedBlob,
  EncryptedWire,
  SystemId,
} from "@pluralscape/types";

export type CustomFrontResult = EncryptedWire<CustomFrontServerMetadata>;

export function toCustomFrontResult(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): CustomFrontResult {
  return {
    id: brandId<CustomFrontId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
