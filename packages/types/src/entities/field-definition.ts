import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { BucketId, FieldDefinitionId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** The supported field types for custom fields (single source of truth). */
export const FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "color",
  "select",
  "multi-select",
  "url",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Per-definition visibility within a privacy bucket. */
export interface FieldBucketVisibility {
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly bucketId: BucketId;
}

/** A user-defined custom field definition. */
export interface FieldDefinition extends AuditMetadata {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly fieldType: FieldType;
  /** Valid options for select / multi-select fields. Null for other types. */
  readonly options: readonly string[] | null;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly archived: false;
}

/**
 * Keys of `FieldDefinition` that are encrypted client-side before the server
 * sees them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextFieldDefinition parity)
 * - `FieldDefinitionServerMetadata` (derived via `Omit`)
 * - `FieldDefinitionEncryptedInput` in `packages/data` (derived via `Pick`)
 */
export type FieldDefinitionEncryptedFields = "name" | "description" | "options";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// FieldDefinitionEncryptedInput → FieldDefinitionServerMetadata
//                              → FieldDefinitionResult → FieldDefinitionWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type FieldDefinitionEncryptedInput = Pick<FieldDefinition, FieldDefinitionEncryptedFields>;

/** An archived field definition. */
export type ArchivedFieldDefinition = Archived<FieldDefinition>;

/**
 * Server-visible FieldDefinition metadata — raw Drizzle row shape.
 *
 * Derived from `FieldDefinition` by stripping the encrypted field keys
 * (bundled inside `encryptedData`) and `archived` (the server tracks a
 * mutable boolean with a companion `archivedAt` timestamp, while the domain
 * uses a `false` literal that toggles to `true` via the `Archived<T>`
 * helper).
 */
export type FieldDefinitionServerMetadata = Omit<
  FieldDefinition,
  FieldDefinitionEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

export type FieldDefinitionResult = EncryptedWire<FieldDefinitionServerMetadata>;

export type FieldDefinitionWire = Serialize<FieldDefinitionResult>;
