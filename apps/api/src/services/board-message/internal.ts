import { boardMessages } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { BoardMessageId, SystemId, UnixMillis } from "@pluralscape/types";

export interface BoardMessageResult {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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
