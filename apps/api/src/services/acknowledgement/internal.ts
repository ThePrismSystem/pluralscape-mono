import { acknowledgements } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type { AcknowledgementId, MemberId, SystemId, UnixMillis } from "@pluralscape/types";

// ── Types ───────────────────────────────────────────────────────────

export interface AcknowledgementResult {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly confirmed: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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
