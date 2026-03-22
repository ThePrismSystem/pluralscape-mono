import type { AuditEventType, AuditActor, AuditLogEntry } from "./audit-log.js";
import type {
  Channel,
  ChatMessage,
  BoardMessage,
  Note,
  Poll,
  PollKind,
  PollVote,
  AcknowledgementRequest,
} from "./communication.js";
import type { FieldDefinition, FieldValue, FieldType } from "./custom-fields.js";
import type { FrontingSession, FrontingComment, CustomFront } from "./fronting.js";
import type { Group } from "./groups.js";
import type { MemberPhoto } from "./identity.js";
import type {
  AcknowledgementId,
  AuditLogEntryId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  LifecycleEventId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  JournalEntryId,
  MemberId,
  MemberPhotoId,
  MessageId,
  NoteId,
  PollId,
  PollOptionId,
  PollVoteId,
  RelationshipId,
  SystemId,
  SystemStructureEntityTypeId,
  SystemStructureEntityId,
  TimerId,
  SlugHash,
  WikiPageId,
} from "./ids.js";
import type { InnerWorldEntity, InnerWorldRegion } from "./innerworld.js";
import type { JournalEntry, WikiPage } from "./journal.js";
import type { LifecycleEvent, LifecycleEventType } from "./lifecycle.js";
import type {
  RelationshipType,
  Relationship,
  SystemStructureEntityType,
  SystemStructureEntity,
} from "./structure.js";
import type { TimerConfig } from "./timer.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata, EntityReference } from "./utility.js";

// ── Tier wrappers ──────────────────────────────────────────────

declare const __encTier: unique symbol;

/** T1 zero-knowledge: wrapped value cannot be read by the server. */
export type Encrypted<T> = T & { readonly [__encTier]: 1 };

/** T2 per-bucket: wrapped value is encrypted with a bucket key for friend sharing. */
export type BucketEncrypted<T> = T & { readonly [__encTier]: 2 };

// T3 is plaintext — no wrapper needed. Fields at T3 appear as plain types
// in server-side interfaces (see tier map at bottom of file).

declare const __plaintext: unique symbol;

/** Marks a value as having been decrypted — used to track provenance in audit logs. */
export type Plaintext<T> = T & { readonly [__plaintext]: true };

// ── EncryptionAlgorithm ────────────────────────────────────────

/** Supported encryption algorithms for EncryptedBlob. */
export type EncryptionAlgorithm = "xchacha20-poly1305";

// ── EncryptedBlob ──────────────────────────────────────────────

/** Shared fields across all encrypted blob tiers. */
interface EncryptedBlobBase {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyVersion: number | null;
}

/** T1 zero-knowledge blob — encrypted with the system master key. No bucket association. */
export interface T1EncryptedBlob extends EncryptedBlobBase {
  readonly tier: 1;
  readonly keyVersion: null;
  readonly bucketId: null;
}

/** T2 per-bucket blob — encrypted with a bucket-specific key. Always has a bucketId. */
export interface T2EncryptedBlob extends EncryptedBlobBase {
  readonly tier: 2;
  readonly bucketId: BucketId;
}

/** Wire format for encrypted data. Discriminated union on `tier`. */
export type EncryptedBlob = T1EncryptedBlob | T2EncryptedBlob;

// ── EncryptedString ────────────────────────────────────────────

declare const __encStr: unique symbol;

/** Branded string to prevent accidental logging or display of ciphertext. */
export type EncryptedString = string & { readonly [__encStr]: true };

// ── Server/Client variant pattern ──────────────────────────────
// Server types carry EncryptedBlob; Client types have flat decrypted fields.
// Only defined for completed domain modules.

/**
 * Server-side member representation.
 * T1 encrypted: name, pronouns, description, tags, colors, avatarSource, saturationLevel,
 *   suppressFriendFrontNotification, boardMessageNotificationOnFront
 * T3 plaintext: archived
 */
export interface ServerMember extends AuditMetadata {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side member — flat decrypted fields. Identical to the domain Member type. */
export type ClientMember = import("./identity.js").Member;

/**
 * Server-side fronting session representation.
 * T1 encrypted: comment, positionality, outtrigger, outtriggerSentiment
 * T3 plaintext: timestamps, memberId, customFrontId, structureEntityId, archived
 */
export interface ServerFrontingSession extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side fronting session — flat decrypted fields. */
export type ClientFrontingSession = FrontingSession;

/**
 * Server-side fronting comment representation.
 * T1 encrypted: content
 * T3 plaintext: frontingSessionId, sessionStartTime, memberId, customFrontId, structureEntityId, archived
 */
export interface ServerFrontingComment extends AuditMetadata {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  /** Denormalized from parent fronting session for FK on partitioned table (ADR 019). */
  readonly sessionStartTime: UnixMillis;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side fronting comment — flat decrypted fields. */
export type ClientFrontingComment = FrontingComment;

/**
 * Server-side group representation.
 * T1 encrypted: name, description, imageSource, color, emoji
 * T3 plaintext: sortOrder, archived, parentGroupId
 */
export interface ServerGroup extends AuditMetadata {
  readonly id: GroupId;
  readonly systemId: SystemId;
  readonly parentGroupId: GroupId | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side group — flat decrypted fields. */
export type ClientGroup = Group;

// ── Structure entities ──────────────────────────────────────────

/**
 * Server-side structure entity type representation.
 * T1 encrypted: name, description, emoji, color, imageSource
 * T3 plaintext: sortOrder, archived
 */
export interface ServerStructureEntityType extends AuditMetadata {
  readonly id: SystemStructureEntityTypeId;
  readonly systemId: SystemId;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side structure entity type — flat decrypted fields. */
export type ClientStructureEntityType = SystemStructureEntityType;

/**
 * Server-side structure entity representation.
 * T1 encrypted: name, description, emoji, color, imageSource
 * T3 plaintext: entityTypeId, sortOrder, archived
 */
export interface ServerStructureEntity extends AuditMetadata {
  readonly id: SystemStructureEntityId;
  readonly systemId: SystemId;
  readonly entityTypeId: SystemStructureEntityTypeId;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side structure entity — flat decrypted fields. */
export type ClientStructureEntity = SystemStructureEntity;

/**
 * Server-side relationship representation.
 * T1 encrypted: label
 * T3 plaintext: type, sourceMemberId, targetMemberId, bidirectional, archived
 *
 * ServerRelationship exposes only createdAt; the DB stores updatedAt and
 * version via timestamps()/versioned() but they are not included in the
 * server-side projection.
 */
export interface ServerRelationship {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId | null;
  readonly targetMemberId: MemberId | null;
  readonly type: RelationshipType;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side relationship — flat decrypted fields. */
export type ClientRelationship = Relationship;

// ── Communication ──────────────────────────────────────────────

/**
 * Server-side channel representation.
 * T1 encrypted: name
 * T3 plaintext: type, parentId, sortOrder, archived
 */
export interface ServerChannel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly type: "category" | "channel";
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side channel — flat decrypted fields. */
export type ClientChannel = Channel;

/**
 * Server-side chat message representation.
 * T1 encrypted: content, attachments, mentions, senderId
 * T3 plaintext: channelId, replyToId, timestamp, editedAt, archived
 */
export interface ServerChatMessage extends AuditMetadata {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side chat message — flat decrypted fields. */
export type ClientChatMessage = ChatMessage;

/**
 * Server-side board message representation.
 * T1 encrypted: content, senderId
 * T3 plaintext: pinned, sortOrder, archived
 */
export interface ServerBoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side board message — flat decrypted fields. */
export type ClientBoardMessage = BoardMessage;

/**
 * Server-side note representation.
 * T1 encrypted: title, content, backgroundColor
 * T3 plaintext: memberId, archived
 */
export interface ServerNote extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side note — flat decrypted fields. */
export type ClientNote = Note;

// ── Custom fields ──────────────────────────────────────────────

/**
 * Server-side field definition representation.
 * T1 encrypted: name, description, options
 * T3 plaintext: fieldType, required, sortOrder, archived
 */
export interface ServerFieldDefinition extends AuditMetadata {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  /** Required field type — must be set when creating a field definition. */
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side field definition — flat decrypted fields. */
export type ClientFieldDefinition = FieldDefinition;

/**
 * Server-side field value representation.
 * T1 encrypted: value
 * T3 plaintext: fieldDefinitionId, memberId, structureEntityId, groupId
 */
export interface ServerFieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly groupId: GroupId | null;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side field value — flat decrypted fields. */
export type ClientFieldValue = FieldValue;

// ── Innerworld ─────────────────────────────────────────────────

/**
 * Server-side innerworld entity representation.
 * T1 encrypted: name/linkedMemberId/linkedStructureEntityId, description, visual,
 *   entityType, positionX, positionY
 * T3 plaintext: regionId, archived
 */
export interface ServerInnerWorldEntity extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly regionId: InnerWorldRegionId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side innerworld entity — flat decrypted fields. */
export type ClientInnerWorldEntity = InnerWorldEntity;

/**
 * Server-side innerworld region representation.
 * T1 encrypted: name, description, boundaryData, visual, gatekeeperMemberIds, accessType
 * T3 plaintext: parentRegionId, archived
 */
export interface ServerInnerWorldRegion extends AuditMetadata {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side innerworld region — flat decrypted fields. */
export type ClientInnerWorldRegion = InnerWorldRegion;

// ── Lifecycle ──────────────────────────────────────────────────

/**
 * Server-side lifecycle event representation.
 * T1 encrypted: notes
 */
export interface ServerLifecycleEvent {
  readonly id: LifecycleEventId;
  readonly systemId: SystemId;
  readonly eventType: LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side lifecycle event — flat decrypted fields. */
export type ClientLifecycleEvent = LifecycleEvent;

// ── Custom fronts ──────────────────────────────────────────────

/**
 * Server-side custom front representation.
 * T1 encrypted: name, description, color, emoji
 * T3 plaintext: archived
 */
export interface ServerCustomFront extends AuditMetadata {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side custom front — flat decrypted fields. */
export type ClientCustomFront = CustomFront;

// ── Journal ────────────────────────────────────────────────────

/**
 * Server-side journal entry representation.
 * T1 encrypted: title, blocks, tags, linkedEntities, author
 * T3 plaintext: frontingSessionId, archived
 */
export interface ServerJournalEntry extends AuditMetadata {
  readonly id: JournalEntryId;
  readonly systemId: SystemId;
  readonly frontingSessionId: FrontingSessionId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side journal entry — flat decrypted fields. */
export type ClientJournalEntry = JournalEntry;

/**
 * Server-side wiki page representation.
 * T1 encrypted: title, slug, blocks, tags, linkedEntities, linkedFromPages
 * T3 plaintext: archived, slugHash
 *
 * slugHash is a keyed hash (hex-encoded, 64 chars) of the plaintext slug.
 * The plaintext slug lives inside encryptedData. Client hashes slug locally
 * and queries by (systemId, slugHash). Hash algorithm TBD — see crypto package.
 */
export interface ServerWikiPage extends AuditMetadata {
  readonly id: WikiPageId;
  readonly systemId: SystemId;
  readonly slugHash: SlugHash;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side wiki page — flat decrypted fields. */
export type ClientWikiPage = WikiPage;

// ── Member photos ──────────────────────────────────────────────

/**
 * Server-side member photo representation.
 * T1 encrypted: imageSource, caption
 * T3 plaintext: memberId, sortOrder, archived
 *
 * Intentionally omits AuditMetadata — photos are append-only gallery items.
 * The domain MemberPhoto type also omits it.
 */
export interface ServerMemberPhoto {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side member photo — flat decrypted fields. */
export type ClientMemberPhoto = MemberPhoto;

// ── Polls ──────────────────────────────────────────────────────

/**
 * Server-side poll representation.
 * T1 encrypted: title, options, description
 * T3 plaintext: createdByMemberId, kind, status, closedAt, endsAt,
 *   allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto, archived
 */
export interface ServerPoll extends AuditMetadata {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly kind: PollKind;
  readonly status: "open" | "closed";
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side poll — flat decrypted fields. */
export type ClientPoll = Poll;

/**
 * Server-side poll vote representation.
 * T1 encrypted: comment
 * T3 plaintext: pollId, optionId, voter, isVeto, votedAt, archived
 */
export interface ServerPollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean | null;
  readonly votedAt: UnixMillis | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side poll vote — flat decrypted fields. */
export type ClientPollVote = PollVote;

// ── Acknowledgement requests ───────────────────────────────────

/**
 * Server-side acknowledgement request representation.
 * T1 encrypted: message, targetMemberId, confirmedAt
 * T3 plaintext: createdByMemberId, confirmed, archived
 */
export interface ServerAcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly confirmed: boolean;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side acknowledgement request — flat decrypted fields. */
export type ClientAcknowledgementRequest = AcknowledgementRequest;

// ── Timer config ───────────────────────────────────────────────

/**
 * Server-side timer config representation.
 * T1 encrypted: promptText
 * T3 plaintext: intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, enabled, archived
 */
export interface ServerTimerConfig extends AuditMetadata {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly intervalMinutes: number;
  readonly wakingHoursOnly: boolean;
  readonly wakingStart: string;
  readonly wakingEnd: string;
  readonly enabled: boolean;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side timer config — flat decrypted fields. */
export type ClientTimerConfig = TimerConfig;

// ── Audit log ──────────────────────────────────────────────────

/**
 * Server-side audit log entry representation.
 * T3 plaintext (all fields): detail, eventType, actor, ipAddress, userAgent, timestamp
 *
 * Unlike other Server* types, this has no `encryptedData` field — all fields are T3
 * (server-readable) because the server needs detail for security monitoring
 * (failed login detection, IP pattern analysis).
 *
 * Note: Uses `timestamp` (not `createdAt`) to match the DB column name.
 * The audit_log table intentionally uses `timestamp` to reflect when the
 * event occurred, not when the row was created. The client-side
 * AuditLogEntry type uses `createdAt` — the mapping layer will handle this rename.
 */
export interface ServerAuditLogEntry {
  readonly id: AuditLogEntryId;
  readonly systemId: SystemId;
  readonly eventType: AuditEventType;
  readonly timestamp: UnixMillis;
  readonly actor: AuditActor;
  readonly detail: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/** Client-side audit log entry — flat decrypted fields. */
export type ClientAuditLogEntry = AuditLogEntry;

// ── Server-safe response unions ────────────────────────────────

/** Union of all server-side types safe to return from API routes. */
export type ServerResponseData =
  | ServerMember
  | ServerFrontingSession
  | ServerFrontingComment
  | ServerGroup
  | ServerStructureEntityType
  | ServerStructureEntity
  | ServerRelationship
  | ServerChannel
  | ServerChatMessage
  | ServerBoardMessage
  | ServerNote
  | ServerFieldDefinition
  | ServerFieldValue
  | ServerInnerWorldEntity
  | ServerInnerWorldRegion
  | ServerLifecycleEvent
  | ServerCustomFront
  | ServerJournalEntry
  | ServerWikiPage
  | ServerMemberPhoto
  | ServerPoll
  | ServerPollVote
  | ServerAcknowledgementRequest
  | ServerTimerConfig
  | ServerAuditLogEntry;

/** Union of all client-side types that must NEVER appear in API responses. */
export type ClientResponseData =
  | ClientMember
  | ClientFrontingSession
  | ClientFrontingComment
  | ClientGroup
  | ClientStructureEntityType
  | ClientStructureEntity
  | ClientRelationship
  | ClientChannel
  | ClientChatMessage
  | ClientBoardMessage
  | ClientNote
  | ClientFieldDefinition
  | ClientFieldValue
  | ClientInnerWorldEntity
  | ClientInnerWorldRegion
  | ClientLifecycleEvent
  | ClientCustomFront
  | ClientJournalEntry
  | ClientWikiPage
  | ClientMemberPhoto
  | ClientPoll
  | ClientPollVote
  | ClientAcknowledgementRequest
  | ClientTimerConfig
  | ClientAuditLogEntry;

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: Uint8Array) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: Uint8Array) => ServerT;

// ── Tier map ───────────────────────────────────────────────────
//
// Member: T1 (name, pronouns, description, tags, colors, avatarSource, saturationLevel, suppressFriendFrontNotification, boardMessageNotificationOnFront) | T3 (archived)
// FrontingSession: T1 (comment, positionality, outtrigger, outtriggerSentiment) | T3 (timestamps, memberId, customFrontId, structureEntityId, linkedStructure, archived)
// FrontingComment: T1 (content) | T3 (frontingSessionId, memberId, archived) — extends AuditMetadata
// Group: T1 (name, description, imageSource, color, emoji) | T3 (sortOrder, archived, parentGroupId)
// StructureEntityType: T1 (name, description, emoji, color, imageSource) | T3 (sortOrder, archived)
// StructureEntity: T1 (name, description, emoji, color, imageSource) | T3 (entityTypeId, sortOrder, archived)
// Relationship: T1 (label) | T3 (type, sourceMemberId, targetMemberId, bidirectional, archived)
// Channel: T1 (name) | T3 (type, parentId, sortOrder, archived)
// ChatMessage: T1 (content, attachments, senderId) | T3 (channelId, replyToId, timestamp, editedAt, archived)
// BoardMessage: T1 (content, senderId) | T3 (pinned, sortOrder, archived)
// Note: T1 (title, content, backgroundColor) | T3 (memberId, archived)
// FieldDefinition: T1 (name, description, options) | T3 (fieldType, required, sortOrder, archived)
// FieldValue: T1 (value) | T3 (fieldDefinitionId, memberId, structureEntityId, groupId)
// InnerWorldEntity: T1 (linked entity refs, description, visual, entityType, positionX, positionY) | T3 (regionId, archived)
// InnerWorldRegion: T1 (name, description, boundaryData, visual, gatekeeperMemberIds, accessType) | T3 (parentRegionId, archived)
// LifecycleEvent: T1 (notes) | T3 (eventType, occurredAt, recordedAt)
// CustomFront: T1 (name, description, color, emoji) | T3 (archived)
// JournalEntry: T1 (title, blocks, tags, linkedEntities, author) | T3 (frontingSessionId, archived)
// WikiPage: T1 (title, slug, blocks, tags, linkedEntities, linkedFromPages) | T3 (archived, slugHash)
// MemberPhoto: T1 (imageSource, caption) | T3 (memberId, sortOrder, archived)
// Poll: T1 (title, options, description) | T3 (createdByMemberId, kind, status, closedAt, endsAt, allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto, archived)
// PollVote: T1 (comment) | T3 (pollId, optionId, voter, isVeto, votedAt, archived)
// AcknowledgementRequest: T1 (message, targetMemberId, confirmedAt) | T3 (createdByMemberId, confirmed, archived)
// TimerConfig: T1 (promptText) | T3 (intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, enabled, archived)
// AuditLogEntry: T3 (all fields — detail, eventType, actor, ipAddress, userAgent, timestamp; server-readable for security monitoring)
//
// SystemSnapshot: T1 (name, description, SnapshotContent — all inside encryptedData) | T3 (trigger, createdAt)
//
// FrontingReport: client-generated, stored locally; member names in chart labels are T1 encrypted client-side
//
// Session: T1 (deviceInfo inside encryptedData) | T3 (accountId, revoked, timestamps, expiresAt)
// ApiKey: T1 (name, inside encryptedData) | T3 (scopes — server enforces authorization; scopedBucketIds — server enforces bucket-scoped auth; keyType, tokenHash, timestamps, encryptedKeyMaterial)
// BlobMetadata: T3 (mimeType — server must set Content-Type headers and validate uploads;
//   purpose — server enforces per-purpose quota limits; sizeBytes — server enforces quota
//   and validates uploads; all remaining fields are operational metadata. Encrypting any of
//   these would require trusting client-reported values, which is a security hole. This matches
//   how all E2E encrypted storage systems handle blob metadata.)
// JobDefinition: T3 (all fields — server-internal job metadata)
// ImportJob: T3 (source — server must know source format to select the correct import parser;
//   status, errorMessage, stats — operational metadata for transient job records. The revealed
//   info (prior app choice) is extremely low sensitivity. Moving parsing client-side would be
//   a major architecture change disproportionate to the risk.)
// DeviceToken: T3 (token, platform, lastActiveAt — server must read push tokens to deliver notifications)
// NotificationConfig: T3 (all fields — user preferences, no sensitive content)
// NotificationPayload: T1 (title, body, data) | T3 (eventType, systemId)
// WebhookConfig: T1 (secret via EncryptedString) | T3 (url — server must read to deliver webhooks;
//   eventTypes — server must read to route/filter events; enabled, cryptoKeyId)
// WebhookDelivery: T1 (encryptedData) | T3 (eventType, httpStatus, attemptCount, lastAttemptAt, nextRetryAt, createdAt)
// RealtimeSubscription: T3 (all fields — subscription metadata)
// SearchQuery/SearchResult: client-only types, not persisted server-side
