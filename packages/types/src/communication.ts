import type {
  AcknowledgementId,
  BlobId,
  BoardMessageId,
  ChannelId,
  HexColor,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** A communication channel or category within a system. */
export interface Channel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly type: "category" | "channel";
  /** Parent category ID. Null for categories and uncategorized channels. */
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
}

/** A real-time chat message in a channel. */
export interface ChatMessage extends AuditMetadata {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly content: string;
  readonly attachments: readonly BlobId[];
  readonly mentions: readonly MemberId[];
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
}

/** A longer-form message posted to a board. */
export interface BoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly content: string;
  readonly pinned: boolean;
  readonly sortOrder: number;
}

/** A private note within a system. */
export interface Note extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly title: string;
  readonly content: string;
  readonly backgroundColor: HexColor | null;
}

/** A single option within a poll. */
export interface PollOption {
  readonly id: PollOptionId;
  readonly label: string;
  readonly voteCount: number;
}

/** A poll for system-internal decision making. */
export interface Poll extends AuditMetadata {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly title: string;
  readonly options: readonly PollOption[];
  readonly status: "open" | "closed";
  readonly closedAt: UnixMillis | null;
  /** Whether members can vote for multiple options. When false, maxVotesPerMember should be 1. */
  readonly allowMultipleVotes: boolean;
  /** Maximum votes a single member may cast. Must be >= 1. */
  readonly maxVotesPerMember: number;
}

/** A vote cast on a poll option. */
export interface PollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId;
  readonly memberId: MemberId;
  readonly votedAt: UnixMillis;
}

/** A request for a member to acknowledge a message or decision. */
export interface AcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly message: string;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
}
