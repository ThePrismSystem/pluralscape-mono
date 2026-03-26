import type { EncryptedString } from "./encryption.js";
import type {
  AcknowledgementId,
  ApiKeyId,
  BoardMessageId,
  ChannelId,
  MessageId,
  NoteId,
  PollId,
  SystemId,
  WebhookDeliveryId,
  WebhookId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** Status of a webhook delivery attempt. */
export type WebhookDeliveryStatus = "pending" | "success" | "failed";

/** Events that can trigger a webhook. */
export type WebhookEventType =
  // ── Identity ──
  | "member.created"
  | "member.updated"
  | "member.archived"
  | "fronting.started"
  | "fronting.ended"
  | "group.created"
  | "group.updated"
  | "lifecycle.event-recorded"
  | "custom-front.changed"
  // ── Communication: channels ──
  | "channel.created"
  | "channel.updated"
  | "channel.archived"
  | "channel.restored"
  | "channel.deleted"
  // ── Communication: messages ──
  | "message.created"
  | "message.updated"
  | "message.archived"
  | "message.restored"
  | "message.deleted"
  // ── Communication: board messages ──
  | "board-message.created"
  | "board-message.updated"
  | "board-message.pinned"
  | "board-message.unpinned"
  | "board-message.reordered"
  | "board-message.archived"
  | "board-message.restored"
  | "board-message.deleted"
  // ── Communication: notes ──
  | "note.created"
  | "note.updated"
  | "note.archived"
  | "note.restored"
  | "note.deleted"
  // ── Communication: polls ──
  | "poll.created"
  | "poll.updated"
  | "poll.closed"
  | "poll.archived"
  | "poll.restored"
  | "poll.deleted"
  // ── Communication: poll votes ──
  | "poll-vote.cast"
  | "poll-vote.vetoed"
  // ── Communication: acknowledgements ──
  | "acknowledgement.created"
  | "acknowledgement.confirmed"
  | "acknowledgement.archived"
  | "acknowledgement.restored"
  | "acknowledgement.deleted";

// ── T3 payload types (IDs + metadata only, never encrypted content) ──

interface ChannelEventPayload {
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
}

interface MessageEventPayload {
  readonly messageId: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
}

interface BoardMessageEventPayload {
  readonly boardMessageId: BoardMessageId;
  readonly systemId: SystemId;
}

interface NoteEventPayload {
  readonly noteId: NoteId;
  readonly systemId: SystemId;
}

interface PollEventPayload {
  readonly pollId: PollId;
  readonly systemId: SystemId;
}

interface PollVoteEventPayload {
  readonly pollId: PollId;
  readonly systemId: SystemId;
}

interface AcknowledgementEventPayload {
  readonly acknowledgementId: AcknowledgementId;
  readonly systemId: SystemId;
}

/** Maps each webhook event type to its T3 payload shape. */
export interface WebhookEventPayloadMap {
  // ── Identity ──
  "member.created": { readonly memberId: string; readonly systemId: SystemId };
  "member.updated": { readonly memberId: string; readonly systemId: SystemId };
  "member.archived": { readonly memberId: string; readonly systemId: SystemId };
  "fronting.started": { readonly sessionId: string; readonly systemId: SystemId };
  "fronting.ended": { readonly sessionId: string; readonly systemId: SystemId };
  "group.created": { readonly groupId: string; readonly systemId: SystemId };
  "group.updated": { readonly groupId: string; readonly systemId: SystemId };
  "lifecycle.event-recorded": { readonly eventId: string; readonly systemId: SystemId };
  "custom-front.changed": { readonly customFrontId: string; readonly systemId: SystemId };
  // ── Communication: channels ──
  "channel.created": ChannelEventPayload;
  "channel.updated": ChannelEventPayload;
  "channel.archived": ChannelEventPayload;
  "channel.restored": ChannelEventPayload;
  "channel.deleted": ChannelEventPayload;
  // ── Communication: messages ──
  "message.created": MessageEventPayload;
  "message.updated": MessageEventPayload;
  "message.archived": MessageEventPayload;
  "message.restored": MessageEventPayload;
  "message.deleted": MessageEventPayload;
  // ── Communication: board messages ──
  "board-message.created": BoardMessageEventPayload;
  "board-message.updated": BoardMessageEventPayload;
  "board-message.pinned": BoardMessageEventPayload;
  "board-message.unpinned": BoardMessageEventPayload;
  "board-message.reordered": BoardMessageEventPayload;
  "board-message.archived": BoardMessageEventPayload;
  "board-message.restored": BoardMessageEventPayload;
  "board-message.deleted": BoardMessageEventPayload;
  // ── Communication: notes ──
  "note.created": NoteEventPayload;
  "note.updated": NoteEventPayload;
  "note.archived": NoteEventPayload;
  "note.restored": NoteEventPayload;
  "note.deleted": NoteEventPayload;
  // ── Communication: polls ──
  "poll.created": PollEventPayload;
  "poll.updated": PollEventPayload;
  "poll.closed": PollEventPayload;
  "poll.archived": PollEventPayload;
  "poll.restored": PollEventPayload;
  "poll.deleted": PollEventPayload;
  // ── Communication: poll votes ──
  "poll-vote.cast": PollVoteEventPayload;
  "poll-vote.vetoed": PollVoteEventPayload;
  // ── Communication: acknowledgements ──
  "acknowledgement.created": AcknowledgementEventPayload;
  "acknowledgement.confirmed": AcknowledgementEventPayload;
  "acknowledgement.archived": AcknowledgementEventPayload;
  "acknowledgement.restored": AcknowledgementEventPayload;
  "acknowledgement.deleted": AcknowledgementEventPayload;
}

/** Configuration for a webhook endpoint. */
export interface WebhookConfig extends AuditMetadata {
  readonly id: WebhookId;
  readonly systemId: SystemId;
  readonly url: string;
  readonly secret: EncryptedString;
  readonly eventTypes: readonly WebhookEventType[];
  readonly enabled: boolean;
  /** Crypto key for encrypted webhook payloads. Null for plaintext delivery. */
  readonly cryptoKeyId: ApiKeyId | null;
  readonly archived: false;
}

/** An archived webhook config. */
export type ArchivedWebhookConfig = Archived<WebhookConfig>;

/** A record of a webhook delivery attempt with retry lifecycle. */
export interface WebhookDelivery {
  readonly id: WebhookDeliveryId;
  readonly systemId: SystemId;
  readonly webhookId: WebhookId;
  readonly eventType: WebhookEventType;
  readonly status: WebhookDeliveryStatus;
  readonly httpStatus: number | null;
  readonly attemptCount: number;
  readonly lastAttemptAt: UnixMillis | null;
  readonly nextRetryAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly archived: false;
  readonly archivedAt: UnixMillis | null;
}

/** An archived webhook delivery. */
export type ArchivedWebhookDelivery = Archived<WebhookDelivery>;
