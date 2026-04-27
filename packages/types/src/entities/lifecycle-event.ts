import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  InnerWorldEntityId,
  InnerWorldRegionId,
  LifecycleEventId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { EntityReference } from "../utility.js";
import type { LifecycleEventForm, LifecycleEventName } from "../value-types.js";
import type { InnerWorldEntityType } from "./innerworld-entity.js";

/**
 * Shared fields for all lifecycle events.
 *
 * Intentionally does not extend AuditMetadata — lifecycle events are
 * append-only immutable records with their own timestamp semantics.
 * `archived: false` is included to enable the `Archived<LifecycleEvent>`
 * utility type for the archived variant.
 */
interface LifecycleEventBase {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly notes: string | null;
  readonly archived: false;
}

/** A member split into one or more new members. */
export interface SplitEvent extends LifecycleEventBase {
  readonly eventType: "split";
  readonly sourceMemberId: MemberId;
  readonly resultMemberIds: readonly MemberId[];
}

/** Two or more members fused into one. */
export interface FusionEvent extends LifecycleEventBase {
  readonly eventType: "fusion";
  readonly sourceMemberIds: readonly MemberId[];
  readonly resultMemberId: MemberId;
}

/** Two or more members temporarily merged (reversible blurring). */
export interface MergeEvent extends LifecycleEventBase {
  readonly eventType: "merge";
  readonly memberIds: readonly MemberId[];
}

/** A previously merged group of members unmerges. */
export interface UnmergeEvent extends LifecycleEventBase {
  readonly eventType: "unmerge";
  readonly memberIds: readonly MemberId[];
}

/** A member enters dormancy. */
export interface DormancyStartEvent extends LifecycleEventBase {
  readonly eventType: "dormancy-start";
  readonly memberId: MemberId;
  readonly relatedLifecycleEventId: LifecycleEventId | null;
}

/** A member exits dormancy. */
export interface DormancyEndEvent extends LifecycleEventBase {
  readonly eventType: "dormancy-end";
  readonly memberId: MemberId;
  readonly relatedLifecycleEventId: LifecycleEventId | null;
}

/** A new member is discovered. */
export interface DiscoveryEvent extends LifecycleEventBase {
  readonly eventType: "discovery";
  readonly memberId: MemberId;
}

/** An entity is archived (reversible removal). */
export interface ArchivalEvent extends LifecycleEventBase {
  readonly eventType: "archival";
  readonly entity: EntityReference;
}

/** A structure entity forms from a member or group of members. */
export interface StructureEntityFormationEvent extends LifecycleEventBase {
  readonly eventType: "structure-entity-formation";
  readonly memberId: MemberId;
  readonly resultStructureEntityId: SystemStructureEntityId;
}

/** A member's form changes (e.g. age, appearance, species). */
export interface FormChangeEvent extends LifecycleEventBase {
  readonly eventType: "form-change";
  readonly memberId: MemberId;
  readonly previousForm: LifecycleEventForm | null;
  readonly newForm: LifecycleEventForm | null;
}

/** A member's name changes. */
export interface NameChangeEvent extends LifecycleEventBase {
  readonly eventType: "name-change";
  readonly memberId: MemberId;
  readonly previousName: LifecycleEventName | null;
  readonly newName: LifecycleEventName;
}

/** A member moves within the system structure. */
export interface StructureMoveEvent extends LifecycleEventBase {
  readonly eventType: "structure-move";
  readonly memberId: MemberId;
  readonly fromStructure: EntityReference<"structure-entity"> | null;
  readonly toStructure: EntityReference<"structure-entity">;
}

/** An entity moves within the innerworld (between regions). */
export interface InnerworldMoveEvent extends LifecycleEventBase {
  readonly eventType: "innerworld-move";
  readonly entityId: InnerWorldEntityId;
  readonly entityType: InnerWorldEntityType;
  readonly fromRegionId: InnerWorldRegionId | null;
  readonly toRegionId: InnerWorldRegionId | null;
}

/** All possible lifecycle events — discriminated on eventType. */
export type LifecycleEvent =
  | SplitEvent
  | FusionEvent
  | MergeEvent
  | UnmergeEvent
  | DormancyStartEvent
  | DormancyEndEvent
  | DiscoveryEvent
  | ArchivalEvent
  | StructureEntityFormationEvent
  | FormChangeEvent
  | NameChangeEvent
  | StructureMoveEvent
  | InnerworldMoveEvent;

/** The set of valid lifecycle event type strings. */
export type LifecycleEventType = LifecycleEvent["eventType"];

/**
 * Keys of `LifecycleEvent` variants that are encrypted client-side before
 * the server sees them. Plaintext siblings (`eventType`, `occurredAt`, and
 * the event-specific plaintext metadata — member/structure/entity/region
 * IDs) travel as separate request fields and are intentionally excluded.
 *
 * Because `LifecycleEvent` is a discriminated union with per-variant
 * differences, this is the union of every key that may appear in any
 * encrypted blob. The distributive `LifecycleEventEncryptedInput` below
 * then projects each variant by its own key intersection, so no variant
 * is forced to carry keys it does not own.
 *
 * Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `LifecycleEventServerMetadata` (derived via `Omit`)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextLifecycleEvent parity)
 */
export type LifecycleEventEncryptedFields =
  | "notes"
  | "relatedLifecycleEventId"
  | "previousForm"
  | "newForm"
  | "previousName"
  | "newName"
  | "entity"
  | "entityType";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// LifecycleEventEncryptedInput → LifecycleEventServerMetadata
//                             → LifecycleEventResult → LifecycleEventWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

/**
 * Per-variant projection over encrypted keys. `Extract<keyof V, ...>`
 * intersects the encrypted-fields union with each variant's own keys so
 * that `Pick<SplitEvent, "relatedLifecycleEventId">` (which would error)
 * never occurs — each variant contributes only the keys it actually owns.
 */
export type LifecycleEventEncryptedInput = LifecycleEvent extends unknown
  ? Pick<LifecycleEvent, Extract<keyof LifecycleEvent, LifecycleEventEncryptedFields>>
  : never;

/**
 * Server-visible LifecycleEvent metadata — raw Drizzle row shape.
 *
 * Derived from the `LifecycleEvent` discriminated union by distributively
 * removing every event-specific key (each variant's polymorphic target IDs
 * — `sourceMemberId`, `resultMemberIds`, `memberIds`, `entity`, etc.) and
 * `eventType` (re-added below as a plain union), leaving only the shared
 * `LifecycleEventBase` columns. The DB stores variant-specific references
 * in a `plaintextMetadata` JSONB column rather than typed columns. Adds
 * `updatedAt`, `version`, `archived`/`archivedAt`, and the encrypted blob.
 *
 * LifecycleEvent does NOT extend `AuditMetadata` (append-only, no
 * `createdAt`); `recordedAt` serves as the server-visible creation time.
 */
export type LifecycleEventServerMetadata = {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob;
  readonly plaintextMetadata: Record<string, unknown> | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

export type LifecycleEventResult = EncryptedWire<LifecycleEventServerMetadata>;

export type LifecycleEventWire = Serialize<LifecycleEventResult>;
