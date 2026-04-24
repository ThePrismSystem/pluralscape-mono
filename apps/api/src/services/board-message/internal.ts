import { boardMessages } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  BoardMessageId,
  BoardMessageServerMetadata,
  EncryptedWire,
  SystemId,
} from "@pluralscape/types";

export type BoardMessageResult = EncryptedWire<BoardMessageServerMetadata>;

export function toBoardMessageResult(row: typeof boardMessages.$inferSelect): BoardMessageResult {
  return {
    id: brandId<BoardMessageId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
