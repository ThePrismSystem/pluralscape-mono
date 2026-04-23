import type { BucketId, FieldDefinitionId, SystemId } from "../ids.js";
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
 * - Plan 2 fleet will consume when deriving `FieldDefinitionServerMetadata`.
 */
export type FieldDefinitionEncryptedFields = "name" | "description" | "options";

/** An archived field definition. */
export type ArchivedFieldDefinition = Archived<FieldDefinition>;

// ── Request body types ──────────────────────────────────────────

/** Request body for creating a field definition. */
export interface CreateFieldDefinitionBody {
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly encryptedData: string;
}

/** Request body for updating a field definition. */
export interface UpdateFieldDefinitionBody {
  readonly required?: boolean;
  readonly sortOrder?: number;
  readonly encryptedData: string;
  readonly version: number;
}
