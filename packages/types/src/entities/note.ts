import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AnyBrandedId, HexColor, NoteId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata, EntityReference } from "../utility.js";

/** Valid entity types that can author a note. */
export type NoteAuthorEntityType = "member" | "structure-entity";

/** Runtime array of valid note author entity types (for Zod schemas and DB CHECK constraints). */
export const NOTE_AUTHOR_ENTITY_TYPES = [
  "member",
  "structure-entity",
] as const satisfies readonly NoteAuthorEntityType[];

/** A private note within a system. */
export interface Note extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly author: EntityReference<NoteAuthorEntityType> | null;
  readonly title: string;
  readonly content: string;
  readonly backgroundColor: HexColor | null;
  readonly archived: false;
}

/** An archived note. */
export type ArchivedNote = Archived<Note>;

/**
 * Server-visible Note metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the polymorphic `author` reference is flattened on the DB
 * row into two plaintext columns (`authorEntityType` + `authorEntityId`) to
 * support indexing by author type. The `title`, `content`, and
 * `backgroundColor` fields are bundled inside the opaque `encryptedData`
 * blob. `authorEntityId` is polymorphic — companion `authorEntityType`
 * discriminates the actual brand at the application layer, so the column
 * carries `string` at the type level. `archived: false` on the domain flips
 * to a mutable boolean here, with a companion `archivedAt` timestamp.
 */
export type NoteServerMetadata = Omit<
  Note,
  "author" | "title" | "content" | "backgroundColor" | "archived"
> & {
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: AnyBrandedId | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of a Note. Derived from the domain `Note` type
 * via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 */
export type NoteWire = Serialize<Note>;
