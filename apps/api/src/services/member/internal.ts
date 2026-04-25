import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { MemberRow } from "@pluralscape/db/pg";
import type { MemberId, MemberResult, SystemId } from "@pluralscape/types";

export type { MemberResult };

export function toMemberResult(row: MemberRow): MemberResult {
  return {
    id: brandId<MemberId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
