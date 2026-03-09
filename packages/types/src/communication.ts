import type {
  AcknowledgementId,
  BoardMessageId,
  ChannelId,
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

/** A communication channel within a system. */
export interface Channel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly archived: false;
}

/** A real-time chat message in a channel. */
export interface ChatMessage extends AuditMetadata {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly authorMemberId: MemberId;
  readonly content: string;
  readonly editedAt: UnixMillis | null;
}

/** A longer-form message posted to a board. */
export interface BoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly authorMemberId: MemberId;
  readonly title: string;
  readonly content: string;
  readonly pinned: boolean;
}

/** A private note within a system. */
export interface Note extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly authorMemberId: MemberId;
  readonly title: string;
  readonly content: string;
}

/** A single option within a poll. */
export interface PollOption {
  readonly id: PollOptionId;
  readonly pollId: PollId;
  readonly label: string;
  readonly sortOrder: number;
}

/** A poll for system-internal decision making. */
export interface Poll extends AuditMetadata {
  readonly id: PollId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly authorMemberId: MemberId;
  readonly question: string;
  readonly options: readonly PollOption[];
  readonly multipleChoice: boolean;
  readonly closedAt: UnixMillis | null;
}

/** A vote cast on a poll option. */
export interface PollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId;
  readonly memberId: MemberId;
  readonly createdAt: UnixMillis;
}

/** A request for one or more members to acknowledge a message or decision. */
export interface AcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly requestedByMemberId: MemberId;
  readonly targetMemberIds: readonly MemberId[];
  readonly message: string;
  readonly acknowledgedByMemberIds: readonly MemberId[];
}
