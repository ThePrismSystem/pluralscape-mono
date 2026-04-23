import type {
  FieldDefinitionId,
  FieldValueId,
  GroupId,
  MemberId,
  SystemStructureEntityId,
} from "../ids.js";
import type { AuditMetadata } from "../utility.js";

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

/** A value stored for a specific field on an entity. */
export interface FieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly value: FieldValueUnion;
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
