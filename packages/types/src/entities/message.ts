import type {
  BlobId,
  ChannelId,
  MemberId,
  MessageId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Archived, AuditMetadata } from "../utility.js";

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
  readonly archived: false;
}

/** An archived chat message. */
export type ArchivedChatMessage = Archived<ChatMessage>;
