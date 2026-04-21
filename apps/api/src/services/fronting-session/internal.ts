import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  CustomFrontId,
  EncryptedBlob,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

export interface FrontingSessionResult {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export function toFrontingSessionResult(row: {
  id: string;
  systemId: string;
  memberId: string | null;
  customFrontId: string | null;
  structureEntityId: string | null;
  startTime: number;
  endTime: number | null;
  encryptedData: EncryptedBlob;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): FrontingSessionResult {
  return {
    id: brandId<FrontingSessionId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    memberId: row.memberId ? brandId<MemberId>(row.memberId) : null,
    customFrontId: row.customFrontId ? brandId<CustomFrontId>(row.customFrontId) : null,
    structureEntityId: row.structureEntityId
      ? brandId<SystemStructureEntityId>(row.structureEntityId)
      : null,
    startTime: toUnixMillis(row.startTime),
    endTime: toUnixMillisOrNull(row.endTime),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
