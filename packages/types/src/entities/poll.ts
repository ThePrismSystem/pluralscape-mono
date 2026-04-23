import type {
  HexColor,
  MemberId,
  PollId,
  PollOptionId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A single option within a poll. */
export interface PollOption {
  readonly id: PollOptionId;
  readonly label: string;
  readonly voteCount: number;
  readonly color: HexColor | null;
  readonly emoji: string | null;
}

/** The kind of poll — standard yes/no-style or custom option set. */
export type PollKind = "standard" | "custom";

/** Poll kind values as a tuple for runtime validation. */
export const POLL_KINDS = ["standard", "custom"] as const satisfies readonly PollKind[];

/** The lifecycle status of a poll. */
export type PollStatus = "open" | "closed";

/** Poll status values as a tuple for runtime validation. */
export const POLL_STATUSES = ["open", "closed"] as const satisfies readonly PollStatus[];

/** A poll for system-internal decision making. */
export interface Poll extends AuditMetadata {
  readonly id: PollId;
  readonly systemId: SystemId;
  /** Member who created the poll. null when imported from a source system (e.g., Simply Plural) that has no per-poll creator concept. */
  readonly createdByMemberId: MemberId | null;
  readonly title: string;
  readonly description: string | null;
  readonly kind: PollKind;
  readonly options: readonly PollOption[];
  readonly status: PollStatus;
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  /** Whether members can vote for multiple options. When false, maxVotesPerMember should be 1. */
  readonly allowMultipleVotes: boolean;
  /** Maximum votes a single member may cast. Must be >= 1. */
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly archived: false;
}

/** An archived poll. */
export type ArchivedPoll = Archived<Poll>;
