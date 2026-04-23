import type { HexColor, NoteId, SystemId } from "../ids.js";
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
