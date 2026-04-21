import { brandId, toUnixMillis } from "@pluralscape/types";

import { encryptedBlobToBase64OrNull } from "../../lib/encrypted-blob.js";

import type { EncryptedBlob, SystemId, UnixMillis } from "@pluralscape/types";

export interface SystemProfileResult {
  readonly id: SystemId;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export function toSystemProfileResult(row: {
  id: string;
  encryptedData: EncryptedBlob | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}): SystemProfileResult {
  return {
    id: brandId<SystemId>(row.id),
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
