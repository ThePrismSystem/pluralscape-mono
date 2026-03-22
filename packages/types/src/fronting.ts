import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  HexColor,
  MemberId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata, EntityReference } from "./utility.js";

/** Sentiment classification for an outtrigger reason. */
export type OuttriggerSentiment = "negative" | "neutral" | "positive";

/** Shared fields for all fronting session variants. */
interface FrontingSessionBase extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly startTime: UnixMillis;
  /** Free-text status comment on this session. Max 50 characters (runtime enforced). SP-compatible. */
  readonly comment: string | null;
  readonly customFrontId: CustomFrontId | null;
  /** Reference to a linked structure entity (subsystem, side system, or layer). */
  readonly linkedStructure: EntityReference<"subsystem" | "side-system" | "layer"> | null;
  /** Free-text description of fronting positionality (e.g. close vs far, height). */
  readonly positionality: string | null;
  /** Free-text reason describing what caused the fronting change. Stored in T1 encrypted blob. */
  readonly outtrigger: string | null;
  /** Sentiment classification for the outtrigger reason. Stored in T1 encrypted blob. */
  readonly outtriggerSentiment: OuttriggerSentiment | null;
  readonly archived: false;
}

/** A fronting session that is still active (no end time). */
export interface ActiveFrontingSession extends FrontingSessionBase {
  readonly endTime: null;
}

/** A fronting session that has ended. */
export interface CompletedFrontingSession extends FrontingSessionBase {
  readonly endTime: UnixMillis;
}

/** A comment on a fronting session — unlimited length, multiple per session. */
export interface FrontingComment extends AuditMetadata {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly content: string;
  readonly archived: false;
}

/** An archived fronting comment. */
export type ArchivedFrontingComment = Archived<FrontingComment>;

/** A fronting session — discriminated on `endTime` (null = active). */
export type FrontingSession = ActiveFrontingSession | CompletedFrontingSession;

/** An archived fronting session. */
export type ArchivedFrontingSession = Archived<FrontingSession>;

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
export type ArchivedCustomFront = Archived<CustomFront>;

/** Computed snapshot of the current co-fronting state. Not persisted. */
export interface CoFrontState {
  readonly timestamp: UnixMillis;
  readonly activeSessions: readonly ActiveFrontingSession[];
}
