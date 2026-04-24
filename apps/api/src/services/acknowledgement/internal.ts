import { acknowledgements } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  AcknowledgementId,
  AcknowledgementRequestServerMetadata,
  EncryptedWire,
  MemberId,
  SystemId,
} from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────────

export type AcknowledgementResult = EncryptedWire<AcknowledgementRequestServerMetadata>;

// ── Helpers ─────────────────────────────────────────────────────────

export function toAcknowledgementResult(
  row: typeof acknowledgements.$inferSelect,
): AcknowledgementResult {
  return {
    id: brandId<AcknowledgementId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    createdByMemberId: row.createdByMemberId ? brandId<MemberId>(row.createdByMemberId) : null,
    confirmed: row.confirmed,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}
