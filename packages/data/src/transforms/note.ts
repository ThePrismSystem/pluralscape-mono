import { brandId, toUnixMillis } from "@pluralscape/types";
import { NoteEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  EntityReference,
  MemberId,
  Note,
  NoteAuthorEntityType,
  NoteEncryptedInput,
  NoteId,
  NoteWire,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

/** Shape returned by `note.list`. */
export interface NotePage {
  readonly data: readonly NoteWire[];
  readonly nextCursor: string | null;
}

export function decryptNote(raw: NoteWire, masterKey: KdfMasterKey): Note | Archived<Note> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = NoteEncryptedInputSchema.parse(decrypted);

  const author: EntityReference<NoteAuthorEntityType> | null =
    raw.authorEntityType !== null && raw.authorEntityId !== null
      ? raw.authorEntityType === "member"
        ? { entityType: "member", entityId: brandId<MemberId>(raw.authorEntityId) }
        : {
            entityType: "structure-entity",
            entityId: brandId<SystemStructureEntityId>(raw.authorEntityId),
          }
      : null;

  const base = {
    id: brandId<NoteId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    author,
    title: validated.title,
    content: validated.content,
    backgroundColor: validated.backgroundColor,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived note missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptNotePage(
  raw: NotePage,
  masterKey: KdfMasterKey,
): { data: (Note | Archived<Note>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptNote(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptNoteInput(
  data: NoteEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptNoteUpdate(
  data: NoteEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
