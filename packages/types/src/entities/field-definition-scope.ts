import type {
  FieldDefinitionId,
  FieldDefinitionScopeId,
  SystemStructureEntityTypeId,
} from "../ids.js";

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
