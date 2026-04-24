import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  FrontingComment,
  FrontingCommentEncryptedFields as FrontingCommentKeys,
  UnixMillis,
} from "@pluralscape/types";

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a fronting comment blob.
 * Pass this to `encryptFrontingCommentInput` when creating or updating a comment.
 */
export type FrontingCommentPlaintext = Pick<FrontingComment, FrontingCommentKeys>;

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `frontingComment.get` — derived from the `FrontingComment` domain type. */
export type FrontingCommentRaw = Omit<FrontingComment, FrontingCommentKeys | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `frontingComment.list`. */
export interface FrontingCommentPage {
  readonly data: readonly FrontingCommentRaw[];
  readonly nextCursor: string | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertFrontingCommentPlaintext(raw: unknown): asserts raw is FrontingCommentPlaintext {
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
  assertFrontingCommentPlaintext(plaintext);

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
  data: FrontingCommentPlaintext,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt fronting comment plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateFrontingCommentBodySchema`.
 */
export function encryptFrontingCommentUpdate(
  data: FrontingCommentPlaintext,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
