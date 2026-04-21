import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  RelationshipId,
  RelationshipType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface RelationshipResult {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: string | null;
  readonly targetMemberId: string | null;
  readonly type: RelationshipType;
  readonly bidirectional: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

export function toRelationshipResult(row: {
  id: string;
  systemId: string;
  sourceMemberId: string | null;
  targetMemberId: string | null;
  type: RelationshipType;
  bidirectional: boolean;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): RelationshipResult {
  return {
    id: brandId<RelationshipId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    sourceMemberId: row.sourceMemberId,
    targetMemberId: row.targetMemberId,
    type: row.type,
    bidirectional: row.bidirectional,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
