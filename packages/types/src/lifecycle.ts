import type { EventId, MemberId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/**
 * Shared fields for all lifecycle events.
 *
 * Intentionally does not extend AuditMetadata — lifecycle events are
 * append-only immutable records with their own timestamp semantics.
 */
interface LifecycleEventBase {
  readonly id: EventId;
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
  readonly relatedEventId: EventId | null;
}

/** A member exits dormancy. */
export interface DormancyEndEvent extends LifecycleEventBase {
  readonly eventType: "dormancy-end";
  readonly memberId: MemberId;
  readonly relatedEventId: EventId | null;
}

/** A new member is discovered. */
export interface DiscoveryEvent extends LifecycleEventBase {
  readonly eventType: "discovery";
  readonly memberId: MemberId;
}

/** A member is archived (non-destructive removal). */
export interface ArchivalEvent extends LifecycleEventBase {
  readonly eventType: "archival";
  readonly memberId: MemberId;
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
  | ArchivalEvent;

/** The set of valid lifecycle event type strings. */
export type LifecycleEventType = LifecycleEvent["eventType"];
