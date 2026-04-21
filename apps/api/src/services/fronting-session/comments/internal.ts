import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  CustomFrontId,
  EncryptedBlob,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

export interface FrontingCommentResult {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export function toFrontingCommentResult(row: {
  id: string;
  frontingSessionId: string;
  systemId: string;
  memberId: string | null;
  customFrontId: string | null;
  structureEntityId: string | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): FrontingCommentResult {
  return {
    id: brandId<FrontingCommentId>(row.id),
    frontingSessionId: brandId<FrontingSessionId>(row.frontingSessionId),
    systemId: brandId<SystemId>(row.systemId),
    memberId: row.memberId ? brandId<MemberId>(row.memberId) : null,
    customFrontId: row.customFrontId ? brandId<CustomFrontId>(row.customFrontId) : null,
    structureEntityId: row.structureEntityId
      ? brandId<SystemStructureEntityId>(row.structureEntityId)
      : null,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
