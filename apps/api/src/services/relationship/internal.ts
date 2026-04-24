import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  EncryptedBlob,
  EncryptedWire,
  MemberId,
  RelationshipId,
  RelationshipServerMetadata,
  RelationshipType,
  SystemId,
} from "@pluralscape/types";

export type RelationshipResult = EncryptedWire<RelationshipServerMetadata>;

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
    sourceMemberId: row.sourceMemberId ? brandId<MemberId>(row.sourceMemberId) : null,
    targetMemberId: row.targetMemberId ? brandId<MemberId>(row.targetMemberId) : null,
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
