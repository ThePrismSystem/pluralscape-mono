import { brandId, toUnixMillis } from "@pluralscape/types";
import { FrontingCommentEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CustomFrontId,
  FrontingComment,
  FrontingCommentEncryptedInput,
  FrontingCommentId,
  FrontingCommentWire,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

/** Shape returned by `frontingComment.list`. */
export interface FrontingCommentPage {
  readonly data: readonly FrontingCommentWire[];
  readonly nextCursor: string | null;
}

// ── FrontingComment transforms ────────────────────────────────────────

/**
 * Decrypt a single fronting comment wire object to the canonical domain type.
 *
 * The encrypted blob contains: `content`.
 * All other fields pass through from the wire payload.
 */
export function decryptFrontingComment(
  raw: FrontingCommentWire,
  masterKey: KdfMasterKey,
): FrontingComment | Archived<FrontingComment> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = FrontingCommentEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<FrontingCommentId>(raw.id),
    frontingSessionId: brandId<FrontingSessionId>(raw.frontingSessionId),
    systemId: brandId<SystemId>(raw.systemId),
    memberId: raw.memberId !== null ? brandId<MemberId>(raw.memberId) : null,
    customFrontId: raw.customFrontId !== null ? brandId<CustomFrontId>(raw.customFrontId) : null,
    structureEntityId:
      raw.structureEntityId !== null
        ? brandId<SystemStructureEntityId>(raw.structureEntityId)
        : null,
    content: validated.content,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived fronting comment missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated fronting comment list result.
 */
export function decryptFrontingCommentPage(
  raw: FrontingCommentPage,
  masterKey: KdfMasterKey,
): { data: (FrontingComment | Archived<FrontingComment>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptFrontingComment(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt fronting comment fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateFrontingCommentBodySchema`.
 */
export function encryptFrontingCommentInput(
  data: FrontingCommentEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt fronting comment fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateFrontingCommentBodySchema`.
 */
export function encryptFrontingCommentUpdate(
  data: FrontingCommentEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
