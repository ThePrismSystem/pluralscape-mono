import type { BucketId, FieldDefinitionId, FieldValueId, SystemId } from "./ids.js";
import type { AuditMetadata } from "./utility.js";

/** The supported field types for custom fields. */
export type FieldType = "text" | "number" | "boolean" | "date" | "select" | "multi-select" | "url";

/** Visibility of a custom field value within the privacy bucket system. */
export interface FieldBucketVisibility {
  readonly bucketId: BucketId | null;
  readonly visible: boolean;
}

/** A user-defined custom field definition. */
export interface FieldDefinition extends AuditMetadata {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly fieldType: FieldType;
  /** Valid options for select / multi-select fields. Null for other types. */
  readonly selectOptions: readonly string[] | null;
  readonly required: boolean;
  readonly sortOrder: number;
}

/** A value stored for a specific field on an entity. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly definitionId: FieldDefinitionId;
  readonly entityId: string;
  readonly value: FieldValueUnion;
  readonly visibility: FieldBucketVisibility;
}

/** Discriminated union of typed field values. */
export type FieldValueUnion =
  | { readonly fieldType: "text"; readonly value: string }
  | { readonly fieldType: "number"; readonly value: number }
  | { readonly fieldType: "boolean"; readonly value: boolean }
  | { readonly fieldType: "date"; readonly value: string }
  | { readonly fieldType: "select"; readonly value: string }
  | { readonly fieldType: "multi-select"; readonly value: readonly string[] }
  | { readonly fieldType: "url"; readonly value: string };
