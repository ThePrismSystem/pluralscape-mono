import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { MemberId, RelationshipId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

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

/** A relationship between two members. */
export interface Relationship {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly type: RelationshipType;
  /** User-defined label — only meaningful when type is "custom". */
  readonly label: string | null;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: false;
}

/**
 * Keys of `Relationship` that are encrypted client-side before the server sees
 * them. `sourceMemberId`, `targetMemberId`, `type`, and `bidirectional` are
 * sent plaintext because the server needs them for querying. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextRelationship parity)
 * - Plan 2 fleet will consume when deriving `RelationshipServerMetadata`.
 */
export type RelationshipEncryptedFields = "label";

/**
 * Pre-encryption shape — what `encryptRelationshipInput` accepts. Single source
 * of truth: derived from `Relationship` via `Pick<>` over the encrypted-keys union.
 * Single-key projection over `"label"` — not truncated.
 */
export type RelationshipEncryptedInput = Pick<Relationship, RelationshipEncryptedFields>;

export type ArchivedRelationship = Archived<Relationship>;

/**
 * Server-visible Relationship metadata — raw Drizzle row shape.
 *
 * Derived from `Relationship` by stripping the encrypted field key
 * (`label` rides inside `encryptedData`) and `archived` (server tracks a
 * mutable boolean with a companion `archivedAt` timestamp, domain uses
 * `false` literal). Adds DB-only columns the domain doesn't carry:
 * `encryptedData` (T1 blob), `archived`/`archivedAt`, and the rest of
 * `AuditMetadata` (`updatedAt`/`version` — the domain carries only
 * `createdAt`). Non-"custom" relationships carry an empty label inside
 * the blob rather than a nullable column.
 */
export type RelationshipServerMetadata = Omit<
  Relationship,
  RelationshipEncryptedFields | "archived"
> &
  Omit<AuditMetadata, "createdAt"> & {
    readonly encryptedData: EncryptedBlob;
    readonly archived: boolean;
    readonly archivedAt: UnixMillis | null;
  };

/**
 * Server-emit shape — what `toRelationshipResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type RelationshipResult = EncryptedWire<RelationshipServerMetadata>;

/**
 * JSON-serialized wire form of `RelationshipResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type RelationshipWire = Serialize<RelationshipResult>;
