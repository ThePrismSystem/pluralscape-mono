import type {
  InnerWorldEntityId,
  InnerWorldRegionId,
  LifecycleEventId,
  MemberId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { InnerWorldEntityType } from "./innerworld.js";
import type { UnixMillis } from "./timestamps.js";
import type { EntityReference } from "./utility.js";

/**
 * Shared fields for all lifecycle events.
 *
 * Intentionally does not extend AuditMetadata — lifecycle events are
 * append-only immutable records with their own timestamp semantics.
 */
interface LifecycleEventBase {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly notes: string | null;
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

/** A subsystem forms from a member or group of members. */
export interface SubsystemFormationEvent extends LifecycleEventBase {
  readonly eventType: "subsystem-formation";
  readonly memberId: MemberId;
  readonly resultSubsystemId: SubsystemId;
}

/** A member's form changes (e.g. age, appearance, species). */
export interface FormChangeEvent extends LifecycleEventBase {
  readonly eventType: "form-change";
  readonly memberId: MemberId;
  readonly previousForm: string | null;
  readonly newForm: string | null;
}

/** A member's name changes. */
export interface NameChangeEvent extends LifecycleEventBase {
  readonly eventType: "name-change";
  readonly memberId: MemberId;
  readonly previousName: string | null;
  readonly newName: string;
}

/** A member moves within the system structure (subsystem, side system, or layer). */
export interface StructureMoveEvent extends LifecycleEventBase {
  readonly eventType: "structure-move";
  readonly memberId: MemberId;
  readonly fromStructure: EntityReference<"subsystem" | "side-system" | "layer"> | null;
  readonly toStructure: EntityReference<"subsystem" | "side-system" | "layer">;
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
  | SubsystemFormationEvent
  | FormChangeEvent
  | NameChangeEvent
  | StructureMoveEvent
  | InnerworldMoveEvent;

/** The set of valid lifecycle event type strings. */
export type LifecycleEventType = LifecycleEvent["eventType"];
