import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  BoardMessage,
  BoardMessageId,
  MemberId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `boardMessage.get` and `boardMessage.list` items. */
interface BoardMessageRaw {
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

/** Shape returned by `boardMessage.list`. */
interface BoardMessagePage {
  readonly data: readonly BoardMessageRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a board message blob.
 * Pass this to `encryptBoardMessageInput` when creating or updating a board message.
 */
export interface BoardMessageEncryptedFields {
  readonly content: string;
  readonly senderId: MemberId;
}

// ── Validators ────────────────────────────────────────────────────────

function assertBoardMessageEncryptedFields(
  raw: unknown,
): asserts raw is BoardMessageEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted board message blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["content"] !== "string") {
    throw new Error("Decrypted board message blob missing required string field: content");
  }
  if (typeof obj["senderId"] !== "string") {
    throw new Error("Decrypted board message blob missing required string field: senderId");
  }
}

// ── BoardMessage transforms ───────────────────────────────────────────

/**
 * Decrypt a single board message API result into a `BoardMessage`.
 *
 * The encrypted blob contains: `content`, `senderId`.
 * All other fields pass through from the wire payload.
 */
export function decryptBoardMessage(
  raw: BoardMessageRaw,
  masterKey: KdfMasterKey,
): BoardMessage | Archived<BoardMessage> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertBoardMessageEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    senderId: plaintext.senderId,
    content: plaintext.content,
    pinned: raw.pinned,
    sortOrder: raw.sortOrder,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived board message missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated board message list result.
 */
export function decryptBoardMessagePage(
  raw: BoardMessagePage,
  masterKey: KdfMasterKey,
): { data: (BoardMessage | Archived<BoardMessage>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptBoardMessage(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt board message plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateBoardMessageBodySchema`.
 */
export function encryptBoardMessageInput(
  data: BoardMessageEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt board message plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateBoardMessageBodySchema`.
 */
export function encryptBoardMessageUpdate(
  data: BoardMessageEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
