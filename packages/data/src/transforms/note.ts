import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ArchivedNote,
  EntityReference,
  HexColor,
  Note,
  NoteAuthorEntityType,
  NoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `note.get` and `note.list` items. */
interface NoteRaw {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly author: EntityReference<NoteAuthorEntityType> | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `note.list`. */
interface NotePage {
  readonly data: readonly NoteRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a note blob.
 * Pass this to `encryptNoteInput` when creating or updating a note.
 */
export interface NoteEncryptedFields {
  readonly title: string;
  readonly content: string;
  readonly backgroundColor: HexColor | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertNoteEncryptedFields(raw: unknown): asserts raw is NoteEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted note blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["title"] !== "string") {
    throw new Error("Decrypted note blob missing required string field: title");
  }
  if (typeof obj["content"] !== "string") {
    throw new Error("Decrypted note blob missing required string field: content");
  }
}

// ── Note transforms ───────────────────────────────────────────────────

/**
 * Decrypt a single note API result into a `Note`.
 *
 * The encrypted blob contains: `title`, `content`, `backgroundColor`.
 * All other fields pass through from the wire payload.
 */
export function decryptNote(raw: NoteRaw, masterKey: KdfMasterKey): Note | ArchivedNote {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertNoteEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    author: raw.author,
    title: plaintext.title,
    content: plaintext.content,
    backgroundColor: plaintext.backgroundColor,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived note missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated note list result.
 */
export function decryptNotePage(
  raw: NotePage,
  masterKey: KdfMasterKey,
): { data: (Note | ArchivedNote)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptNote(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt note plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateNoteBodySchema`.
 */
export function encryptNoteInput(
  data: NoteEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt note plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateNoteBodySchema`.
 */
export function encryptNoteUpdate(
  data: NoteEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
