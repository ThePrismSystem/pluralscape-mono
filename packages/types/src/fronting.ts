import type {
  CustomFrontId,
  FrontingSessionId,
  HexColor,
  MemberId,
  SubsystemId,
  SwitchId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** Whether a member is fully fronting or co-conscious. */
export type FrontingType = "fronting" | "co-conscious";

/** A fronting session that is still active (no end time). */
export interface ActiveFrontingSession extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly startTime: UnixMillis;
  readonly endTime: null;
  readonly frontingType: FrontingType;
  /** Free-text comment on this session. Max 50 characters (runtime enforced). */
  readonly comment: string | null;
  readonly customFrontId: CustomFrontId | null;
  readonly subsystemId: SubsystemId | null;
}

/** A fronting session that has ended. */
export interface CompletedFrontingSession extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis;
  readonly frontingType: FrontingType;
  /** Free-text comment on this session. Max 50 characters (runtime enforced). */
  readonly comment: string | null;
  readonly customFrontId: CustomFrontId | null;
  readonly subsystemId: SubsystemId | null;
}

/** A fronting session — discriminated on `endTime` (null = active). */
export type FrontingSession = ActiveFrontingSession | CompletedFrontingSession;

/** An immutable event recording a switch between members. */
export interface Switch {
  readonly id: SwitchId;
  readonly systemId: SystemId;
  readonly memberIds: readonly MemberId[];
  readonly timestamp: UnixMillis;
}

/** A user-defined abstract cognitive state logged like a member. */
export interface CustomFront extends AuditMetadata {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly archived: false;
}

/** An archived custom front — preserves all data with archive metadata. */
export type ArchivedCustomFront = Omit<CustomFront, "archived"> & {
  readonly archived: true;
  readonly archivedAt: UnixMillis;
};

/** Computed snapshot of the current co-fronting state. Not persisted. */
export interface CoFrontState {
  readonly timestamp: UnixMillis;
  readonly activeSessions: readonly ActiveFrontingSession[];
}
