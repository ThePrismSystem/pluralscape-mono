import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { MemberId, RelationshipId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived } from "../utility.js";

/** The kind of relationship between two members. */
export type RelationshipType =
  | "split-from"
  | "fused-from"
  | "sibling"
  | "partner"
  | "parent-child"
  | "protector-of"
  | "caretaker-of"
  | "gatekeeper-of"
  | "source"
  | "custom";

interface RelationshipBase {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: false;
}

/** A custom-type relationship — carries a user-defined label. */
export interface CustomRelationship extends RelationshipBase {
  readonly type: "custom";
  readonly label: string;
}

/** A standard-type relationship — no user-defined label. */
export interface StandardRelationship extends RelationshipBase {
  readonly type: Exclude<RelationshipType, "custom">;
}

/** A relationship between two members. Discriminated by `type`. */
export type Relationship = CustomRelationship | StandardRelationship;

/**
 * Keys of `Relationship` that are encrypted client-side before the server sees
 * them. `sourceMemberId`, `targetMemberId`, `type`, and `bidirectional` are
 * sent plaintext because the server needs them for querying. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextRelationship parity)
 */
export type RelationshipEncryptedFields = "label";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// RelationshipEncryptedInput → RelationshipServerMetadata
//                           → RelationshipResult → RelationshipWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

/**
 * Distributive Pick over the union — `{ label: string }` for the custom
 * variant, `{}` for standard variants (which carry no label key at all).
 */
export type RelationshipEncryptedInput = Relationship extends unknown
  ? Pick<Relationship, Extract<keyof Relationship, RelationshipEncryptedFields>>
  : never;

export type ArchivedRelationship = Archived<Relationship>;

/**
 * Server-visible Relationship metadata — raw Drizzle row shape.
 *
 * Declared as a single non-union shape because the Drizzle `relationships`
 * table returns one object shape (not a union). The discriminated union is
 * purely a domain-level invariant enforced after decryption. The server
 * carries `type: RelationshipType` (flat) and `label` lives inside
 * `encryptedData`. Adds DB-only columns: `encryptedData`, `archived`/
 * `archivedAt`, `updatedAt`, `version`.
 */
export type RelationshipServerMetadata = {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly type: RelationshipType;
  readonly bidirectional: boolean;
  readonly encryptedData: EncryptedBlob;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly version: number;
};

export type RelationshipResult = EncryptedWire<RelationshipServerMetadata>;

export type RelationshipWire = Serialize<RelationshipResult>;
