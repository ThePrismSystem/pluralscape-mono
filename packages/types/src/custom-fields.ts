import type { BucketId, FieldDefinitionId, FieldValueId, MemberId, SystemId } from "./ids.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** The supported field types for custom fields. */
export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "color"
  | "select"
  | "multi-select"
  | "url";

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

/** An archived field definition. */
export type ArchivedFieldDefinition = Archived<FieldDefinition>;

/** A value stored for a specific field on a member. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId;
  readonly value: FieldValueUnion;
}

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

/** Request body for setting a field value. */
export interface SetFieldValueBody {
  readonly encryptedData: string;
}

/** Request body for updating a field value. */
export interface UpdateFieldValueBody {
  readonly encryptedData: string;
  readonly version: number;
}

/** Discriminated union of typed field values. */
export type FieldValueUnion =
  | { readonly fieldType: "text"; readonly value: string }
  | { readonly fieldType: "number"; readonly value: number }
  | { readonly fieldType: "boolean"; readonly value: boolean }
  | { readonly fieldType: "date"; readonly value: string }
  | { readonly fieldType: "color"; readonly value: string }
  | { readonly fieldType: "select"; readonly value: string }
  | { readonly fieldType: "multi-select"; readonly value: readonly string[] }
  | { readonly fieldType: "url"; readonly value: string };
