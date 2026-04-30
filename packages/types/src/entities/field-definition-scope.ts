import type {
  FieldDefinitionId,
  FieldDefinitionScopeId,
  SystemId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { Serialize } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

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

/**
 * Server-visible FieldDefinitionScope metadata — raw Drizzle row shape.
 *
 * FieldDefinitionScope is a plaintext entity (no encryption). The domain
 * type is a minimal binding record, but the Drizzle row carries
 * `systemId` (for multi-column FKs and RLS scoping) plus standard
 * audit/version columns (`createdAt`, `updatedAt`, `version`). No
 * `encryptedFields` union exists — the manifest entry uses `never`.
 */
export type FieldDefinitionScopeServerMetadata = FieldDefinitionScope &
  AuditMetadata & {
    readonly systemId: SystemId;
  };

/**
 * JSON-wire representation of a FieldDefinitionScope. Derived from the
 * domain `FieldDefinitionScope` type via `Serialize<T>`; branded IDs
 * become plain strings.
 *
 * NB: Wire is derived from the domain type (not
 * `FieldDefinitionScopeServerMetadata`) because the row adds `systemId`
 * (used for multi-column FKs and RLS) and full audit metadata
 * (`createdAt`/`updatedAt`/`version`) that the domain — a minimal
 * binding record — does not expose.
 */
export type FieldDefinitionScopeWire = Serialize<FieldDefinitionScope>;
