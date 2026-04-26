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

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// InnerWorldEntityEncryptedInput → InnerWorldEntityServerMetadata
//                               → InnerWorldEntityResult → InnerWorldEntityWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

/**
 * Distributes `Pick<T, K>` over a discriminated union so each variant
 * independently picks its own subset of `K`. The naïve `Pick<Union, K>`
 * would only project keys present on every variant; the conditional must
 * be over a *generic* parameter (not the concrete union alias) for TS to
 * actually distribute.
 */
type DistributivePick<T, K extends PropertyKey> = T extends unknown
  ? Pick<T, Extract<keyof T, K>>
  : never;

/**
 * Distributive `Pick`: result is a union of per-variant projections (one `Pick<...>`
 * per discriminated variant — `MemberEntity`, `LandmarkEntity`, `StructureEntityEntity`),
 * not a single intersected object type.
 */
export type InnerWorldEntityEncryptedInput = DistributivePick<
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields
>;

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

export type InnerWorldEntityResult = EncryptedWire<InnerWorldEntityServerMetadata>;

export type InnerWorldEntityWire = Serialize<InnerWorldEntityResult>;
