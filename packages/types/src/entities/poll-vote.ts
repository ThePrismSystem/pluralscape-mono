import type { PollId, PollOptionId, PollVoteId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Archived, EntityReference } from "../utility.js";

/** A vote cast on a poll option. Null optionId indicates abstain. */
export interface PollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity">;
  readonly comment: string | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly archived: false;
}

/** An archived poll vote. */
export type ArchivedPollVote = Archived<PollVote>;
