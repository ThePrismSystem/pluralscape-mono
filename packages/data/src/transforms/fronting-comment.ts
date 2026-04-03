import { decodeAndDecryptT1, encryptAndEncodeT1 } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  CustomFrontId,
  FrontingComment,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `frontingComment.get` and `frontingComment.list` items. */
interface FrontingCommentRaw {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `frontingComment.list`. */
interface FrontingCommentPage {
  readonly data: readonly FrontingCommentRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a fronting comment blob.
 * Pass this to `encryptFrontingCommentInput` when creating or updating a comment.
 */
export interface FrontingCommentEncryptedFields {
  readonly content: string;
}

// ── Validators ────────────────────────────────────────────────────────

function assertFrontingCommentEncryptedFields(
  raw: unknown,
): asserts raw is FrontingCommentEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted fronting comment blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["content"] !== "string") {
    throw new Error("Decrypted fronting comment blob missing required string field: content");
  }
}

// ── Fronting comment transforms ───────────────────────────────────────

/**
 * Decrypt a single fronting comment API result into a `FrontingComment`.
 *
 * The encrypted blob contains: `content`.
 * All other fields pass through from the wire payload.
 */
export function decryptFrontingComment(
  raw: FrontingCommentRaw,
  masterKey: KdfMasterKey,
): FrontingComment | Archived<FrontingComment> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertFrontingCommentEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    frontingSessionId: raw.frontingSessionId,
    systemId: raw.systemId,
    memberId: raw.memberId,
    customFrontId: raw.customFrontId,
    structureEntityId: raw.structureEntityId,
    content: plaintext.content,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived fronting comment missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
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
 * Encrypt fronting comment plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateFrontingCommentBodySchema`.
 */
export function encryptFrontingCommentInput(
  data: FrontingCommentEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey) };
}

/**
 * Encrypt fronting comment plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateFrontingCommentBodySchema`.
 */
export function encryptFrontingCommentUpdate(
  data: FrontingCommentEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return { encryptedData: encryptAndEncodeT1(data, masterKey), version };
}
