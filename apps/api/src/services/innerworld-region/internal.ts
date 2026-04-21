import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { EncryptedBlob, InnerWorldRegionId, SystemId, UnixMillis } from "@pluralscape/types";

export interface RegionResult {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

export function toRegionResult(row: {
  id: string;
  systemId: string;
  parentRegionId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): RegionResult {
  return {
    id: brandId<InnerWorldRegionId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    parentRegionId: row.parentRegionId ? brandId<InnerWorldRegionId>(row.parentRegionId) : null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
