import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  MemberId,
  MemberPhotoId,
  MemberPhotoServerMetadata,
  SystemId,
} from "@pluralscape/types";

export type MemberPhotoResult = EncryptedWire<MemberPhotoServerMetadata>;

export function toPhotoResult(row: {
  id: string;
  memberId: string;
  systemId: string;
  sortOrder: number;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): MemberPhotoResult {
  return {
    id: brandId<MemberPhotoId>(row.id),
    memberId: brandId<MemberId>(row.memberId),
    systemId: brandId<SystemId>(row.systemId),
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
