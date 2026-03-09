import type { BucketId, FieldDefinitionId, FieldValueId, MemberId, SystemId } from "./ids.js";
import type { AuditMetadata } from "./utility.js";

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
}

/** A value stored for a specific field on a member. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId;
  readonly value: FieldValueUnion;
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
