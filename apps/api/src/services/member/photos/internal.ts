import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  MemberId,
  MemberPhotoId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface MemberPhotoResult {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

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
