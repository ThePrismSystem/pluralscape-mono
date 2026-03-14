import type { ImmutableString } from "@automerge/automerge";

/**
 * Common audit tracking fields present on all LWW-map CRDT entities
 * that correspond to domain types extending AuditMetadata.
 */
export interface CrdtAuditFields {
  createdAt: number;
  updatedAt: number;
}

/**
 * A whole-value LWW string field for use in Automerge document schemas.
 *
 * In Automerge 3.x, plain `string` properties are collaborative text
 * (character-level CRDT). `ImmutableString` gives whole-value LWW semantics —
 * assigning a new value atomically replaces the old one. All V1 string fields
 * use this type.
 *
 * When reading from an Automerge document, access the string value via `.val`.
 */
export type CrdtString = ImmutableString;

/**
 * A nullable whole-value LWW string field.
 */
export type CrdtOptionalString = ImmutableString | null;
