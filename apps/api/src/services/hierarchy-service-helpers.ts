import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";

import type { BaseHierarchyResult } from "./hierarchy-service-types.js";
import type { EncryptedBlob, SystemId } from "@pluralscape/types";

// ── Base field mapper ────────────────────────────────────────────

/** Maps base columns shared by all hierarchy entities. */
export function mapBaseFields(row: {
  id: string;
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt: number | null;
}): BaseHierarchyResult {
  return {
    id: row.id,
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
  };
}
