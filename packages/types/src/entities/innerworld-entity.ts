import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** Visual styling properties for innerworld entities. */
export interface VisualProperties {
  readonly color: HexColor | null;
  readonly icon: string | null;
  readonly size: number | null;
  readonly opacity: number | null;
  readonly imageSource: ImageSource | null;
  readonly externalUrl: string | null;
}

// ── Entity types (discriminated union) ─────────────────────────────

/** Shared base fields for all innerworld entities (unexported). */
interface InnerWorldEntityBase extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly positionX: number;
  readonly positionY: number;
  readonly visual: VisualProperties;
  readonly regionId: InnerWorldRegionId | null;
  readonly archived: false;
}

/** An innerworld entity representing a member's presence. */
export interface MemberEntity extends InnerWorldEntityBase {
  readonly entityType: "member";
  readonly linkedMemberId: MemberId;
}

/** An innerworld entity representing a landmark or location. */
export interface LandmarkEntity extends InnerWorldEntityBase {
  readonly entityType: "landmark";
  readonly name: string;
  readonly description: string | null;
}

/** Linked to a system structure entity. */
export interface StructureEntityEntity extends InnerWorldEntityBase {
  readonly entityType: "structure-entity";
  readonly linkedStructureEntityId: SystemStructureEntityId;
}

/** All innerworld entity variants — discriminated on entityType. */
export type InnerWorldEntity = MemberEntity | LandmarkEntity | StructureEntityEntity;

/** An archived innerworld entity. */
export type ArchivedInnerWorldEntity = Archived<InnerWorldEntity>;

/** The set of valid innerworld entity type strings. */
export type InnerWorldEntityType = InnerWorldEntity["entityType"];

/**
 * Keys of `InnerWorldEntity` (across all variants) that are encrypted
 * client-side before the server sees them. `regionId` is a plaintext
 * sibling (server needs it for hierarchy queries) and is intentionally
 * excluded. Because `InnerWorldEntity` is a discriminated union, callers
 * must use a distributive pick (e.g.
 * `T extends unknown ? Pick<T, K & keyof T> : never`) when deriving the
 * plaintext projection. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextInnerworldEntity parity)
 * - `InnerWorldEntityServerMetadata` (derived via distributive `Omit`)
 */
export type InnerWorldEntityEncryptedFields =
  | "entityType"
  | "positionX"
  | "positionY"
  | "visual"
  | "name"
  | "description"
  | "linkedMemberId"
  | "linkedStructureEntityId";

/**
 * Pre-encryption shape — what `encryptInnerWorldEntityInput` accepts. Single source
 * of truth: derived from `InnerWorldEntity` via distributive `Pick<>` over the
 * encrypted-keys union (each variant independently contributes its subset of keys).
 * Distributive `Pick`: result is a union of per-variant projections (one `Pick<...>`
 * per discriminated variant — `MemberEntity`, `LandmarkEntity`, `StructureEntityEntity`),
 * not a single intersected object type.
 */
export type InnerWorldEntityEncryptedInput = InnerWorldEntity extends unknown
  ? Pick<InnerWorldEntity, InnerWorldEntityEncryptedFields & keyof InnerWorldEntity>
  : never;

/**
 * Distributes `Omit<T, K>` over a discriminated union so each variant
 * independently drops its own subset of `K`. The naïve `Omit<Union, K>`
 * would only strip keys present on every variant; this helper flattens
 * the result to the common residual shape after per-variant stripping.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Server-visible InnerWorldEntity metadata — raw Drizzle row shape.
 *
 * Derived from the `InnerWorldEntity` discriminated union by stripping
 * every encrypted field key (bundled inside `encryptedData`) plus
 * `archived` (domain uses a `false` literal that `Archived<T>` flips to
 * `true`; the server tracks a mutable boolean with a companion
 * `archivedAt` timestamp). After distributive stripping, all variants
 * collapse to the same plaintext residual (`id`, `systemId`, `regionId`
 * + audit metadata), so the result is a single struct rather than a
 * union.
 */
export type InnerWorldEntityServerMetadata = DistributiveOmit<
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toEntityResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type InnerWorldEntityResult = EncryptedWire<InnerWorldEntityServerMetadata>;

/**
 * JSON-serialized wire form of `InnerWorldEntityResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type InnerWorldEntityWire = Serialize<InnerWorldEntityResult>;
