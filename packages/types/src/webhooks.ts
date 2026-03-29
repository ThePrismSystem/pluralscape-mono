import type { EncryptedString } from "./encryption.js";
import type {
  AccountId,
  AcknowledgementId,
  ApiKeyId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  FieldDefinitionId,
  FriendConnectionId,
  FrontingSessionId,
  GroupId,
  LifecycleEventId,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  PollVoteId,
  SystemId,
  WebhookDeliveryId,
  WebhookId,
} from "./ids.js";
import type { BucketContentEntityType } from "./privacy.js";
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
  | "acknowledgement.deleted"
  // ── Privacy: buckets ──
  | "bucket.created"
  | "bucket.updated"
  | "bucket.archived"
  | "bucket.restored"
  | "bucket.deleted"
  | "bucket-content-tag.tagged"
  | "bucket-content-tag.untagged"
  // ── Privacy: field-bucket-visibility ──
  | "field-bucket-visibility.set"
  | "field-bucket-visibility.removed"
  // ── Privacy: friends ──
  | "friend.connected"
  | "friend.removed"
  | "friend.bucket-assigned"
  | "friend.bucket-unassigned";

// ── T3 payload types (IDs + metadata only, never encrypted content) ──
// Note: systemId is auto-injected by the dispatcher — not included in payload interfaces.

interface MemberEventPayload {
  readonly memberId: MemberId;
}

interface FrontingEventPayload {
  readonly sessionId: FrontingSessionId;
}

interface GroupEventPayload {
  readonly groupId: GroupId;
}

interface ChannelEventPayload {
  readonly channelId: ChannelId;
}

interface MessageEventPayload {
  readonly messageId: MessageId;
  readonly channelId: ChannelId;
}

interface BoardMessageEventPayload {
  readonly boardMessageId: BoardMessageId;
}

interface NoteEventPayload {
  readonly noteId: NoteId;
}

interface PollEventPayload {
  readonly pollId: PollId;
}

interface PollVoteEventPayload {
  readonly pollId: PollId;
  readonly voteId: PollVoteId;
}

interface AcknowledgementEventPayload {
  readonly acknowledgementId: AcknowledgementId;
}

interface BucketEventPayload {
  readonly bucketId: BucketId;
}

interface BucketContentTagEventPayload {
  readonly bucketId: BucketId;
  readonly entityType: BucketContentEntityType;
  readonly entityId: string;
}

interface FieldBucketVisibilityEventPayload {
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly bucketId: BucketId;
}

interface FriendConnectionEventPayload {
  readonly connectionId: FriendConnectionId;
  readonly friendAccountId: AccountId;
}

interface FriendBucketAssignmentEventPayload {
  readonly connectionId: FriendConnectionId;
  readonly bucketId: BucketId;
}

/**
 * Maps each webhook event type to its T3 payload shape.
 * The dispatcher auto-injects `systemId` into stored payloads.
 */
export interface WebhookEventPayloadMap {
  // ── Identity ──
  "member.created": MemberEventPayload;
  "member.updated": MemberEventPayload;
  "member.archived": MemberEventPayload;
  "fronting.started": FrontingEventPayload;
  "fronting.ended": FrontingEventPayload;
  "group.created": GroupEventPayload;
  "group.updated": GroupEventPayload;
  "lifecycle.event-recorded": { readonly eventId: LifecycleEventId };
  "custom-front.changed": { readonly customFrontId: CustomFrontId };
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
  // ── Privacy: buckets ──
  "bucket.created": BucketEventPayload;
  "bucket.updated": BucketEventPayload;
  "bucket.archived": BucketEventPayload;
  "bucket.restored": BucketEventPayload;
  "bucket.deleted": BucketEventPayload;
  "bucket-content-tag.tagged": BucketContentTagEventPayload;
  "bucket-content-tag.untagged": BucketContentTagEventPayload;
  // ── Privacy: field-bucket-visibility ──
  "field-bucket-visibility.set": FieldBucketVisibilityEventPayload;
  "field-bucket-visibility.removed": FieldBucketVisibilityEventPayload;
  // ── Privacy: friends ──
  "friend.connected": FriendConnectionEventPayload;
  "friend.removed": FriendConnectionEventPayload;
  "friend.bucket-assigned": FriendBucketAssignmentEventPayload;
  "friend.bucket-unassigned": FriendBucketAssignmentEventPayload;
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
}
