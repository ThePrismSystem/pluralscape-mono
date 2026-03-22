import type {
  BucketId,
  FieldDefinitionId,
  FieldDefinitionScopeId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "./ids.js";
import type { Archived, AuditMetadata } from "./utility.js";

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

/** The entity scope a field definition applies to. */
export type FieldDefinitionScopeType = "system" | "member" | "group" | "structure-entity-type";

/** A scope binding for a field definition, controlling which entity types it applies to. */
export interface FieldDefinitionScope {
  readonly id: FieldDefinitionScopeId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly scopeType: FieldDefinitionScopeType;
  /** The specific structure entity type this scope targets. Null means all entity types when scopeType is "structure-entity-type". */
  readonly scopeEntityTypeId: SystemStructureEntityTypeId | null;
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

/** A value stored for a specific field on an entity. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
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
