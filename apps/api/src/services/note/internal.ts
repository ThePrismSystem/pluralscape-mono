import { notes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { NoteResult, NoteId, SystemId } from "@pluralscape/types";

export function toNoteResult(row: typeof notes.$inferSelect): NoteResult {
  return {
    id: brandId<NoteId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    authorEntityType: row.authorEntityType,
    authorEntityId: row.authorEntityId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
