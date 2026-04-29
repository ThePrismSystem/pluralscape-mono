import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AnyBrandedId, HexColor, NoteId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata, EntityReference } from "../utility.js";
import type { NoteContent, NoteTitle } from "../value-types.js";

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
  readonly title: NoteTitle;
  readonly content: NoteContent;
  readonly backgroundColor: HexColor | null;
  readonly archived: false;
}

/** An archived note. */
export type ArchivedNote = Archived<Note>;

/**
 * Keys of `Note` whose values are encrypted client-side before the server
 * sees them (encrypt-by-default policy via `Exclude<>`).
 *
 * Excluded keys and rationale:
 * - `id` / `systemId` — structural identity, required for server routing
 * - `author` — restructured plaintext: the polymorphic `EntityReference`
 *   flattens into separate `authorEntityType` + `authorEntityId` server
 *   columns for indexing; the value is never inside the encrypted blob
 * - `archived` — mutable server-side flag with companion `archivedAt`
 * - `createdAt` / `updatedAt` / `version` (via `AuditMetadata`) —
 *   server-managed audit timestamps and actor reference
 *
 * Consumed by:
 * - `NoteServerMetadata` (derived via `Omit`)
 * - `NoteEncryptedInput = Pick<Note, NoteEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextNote parity)
 */
export type NoteEncryptedFields = Exclude<
  keyof Note,
  "id" | "systemId" | "author" | "archived" | keyof AuditMetadata
>;

/**
 * Domain field that is plaintext (not encrypted) but restructured on the
 * server row into multiple flat columns. `author` is a polymorphic
 * `EntityReference<...>` on the domain — on the server row it is split
 * into `authorEntityType` + `authorEntityId` for indexing.
 *
 * Distinguished from `NoteEncryptedFields` (which lists keys whose values
 * ride inside the encryptedData blob).
 */
export type NoteRestructuredPlaintextFields = "author";

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
  NoteEncryptedFields | NoteRestructuredPlaintextFields | "archived"
> & {
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: AnyBrandedId | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// NoteEncryptedInput → NoteServerMetadata
//                   → NoteResult → NoteWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type NoteEncryptedInput = Pick<Note, NoteEncryptedFields>;

export type NoteResult = EncryptedWire<NoteServerMetadata>;

export type NoteWire = Serialize<NoteResult>;
