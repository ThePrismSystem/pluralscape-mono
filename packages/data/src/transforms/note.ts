import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  HexColor,
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
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: string | null;
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

// ── Decrypted output type ─────────────────────────────────────────────

/** A fully decrypted note, combining wire metadata with plaintext fields. */
export interface NoteDecrypted {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: string | null;
  readonly title: string;
  readonly content: string;
  readonly backgroundColor: HexColor | null;
  readonly archived: false;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Validators ────────────────────────────────────────────────────────

function assertNoteEncryptedFields(raw: unknown): asserts raw is NoteEncryptedFields {
  const obj = assertObjectBlob(raw, "note");
  assertStringField(obj, "note", "title");
  assertStringField(obj, "note", "content");
}

// ── Note transforms ───────────────────────────────────────────────────

/**
 * Decrypt a single note API result.
 *
 * The encrypted blob contains: `title`, `content`, `backgroundColor`.
 * All other fields pass through from the wire payload.
 */
export function decryptNote(
  raw: NoteRaw,
  masterKey: KdfMasterKey,
): NoteDecrypted | Archived<NoteDecrypted> {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertNoteEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    systemId: raw.systemId,
    authorEntityType: raw.authorEntityType,
    authorEntityId: raw.authorEntityId,
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
): { data: (NoteDecrypted | Archived<NoteDecrypted>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptNote(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt note plaintext fields for create payloads.
 */
export function encryptNoteInput(
  data: NoteEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt note plaintext fields for update payloads.
 */
export function encryptNoteUpdate(
  data: NoteEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
