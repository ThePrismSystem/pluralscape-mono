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
import type { FrontingSession, FrontingType, FrontingComment, CustomFront } from "./fronting.js";
import type { Group } from "./groups.js";
import type { MemberPhoto } from "./identity.js";
import type {
  AcknowledgementId,
  AuditLogEntryId,
  BoardMessageId,
  BucketId,
  ChannelId,
  CustomFrontId,
  EventId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  JournalEntryId,
  LayerId,
  MemberId,
  MemberPhotoId,
  MessageId,
  NoteId,
  PollId,
  PollOptionId,
  PollVoteId,
  RelationshipId,
  SideSystemId,
  SubsystemId,
  SystemId,
  TimerId,
  WikiPageId,
} from "./ids.js";
import type { InnerWorldEntity, InnerWorldRegion } from "./innerworld.js";
import type { JournalEntry, WikiPage } from "./journal.js";
import type { LifecycleEvent, LifecycleEventType } from "./lifecycle.js";
import type {
  RelationshipType,
  Relationship,
  Subsystem,
  SideSystem,
  Layer,
  ArchitectureType,
  DiscoveryStatus,
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

/** Wire format for encrypted data. Carried in server-side entity representations. */
export interface EncryptedBlob {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly tier: 1 | 2;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyVersion: number | null;
  /** Present for T2 blobs — identifies which bucket key was used. */
  readonly bucketId: BucketId | null;
}

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
 * T1 encrypted: comment, positionality
 * T3 plaintext: timestamps, memberId, frontingType, customFrontId, linkedStructure
 */
export interface ServerFrontingSession extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly frontingType: FrontingType;
  readonly customFrontId: CustomFrontId | null;
  readonly linkedStructure: EntityReference<"subsystem" | "side-system" | "layer"> | null;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side fronting session — flat decrypted fields. */
export type ClientFrontingSession = FrontingSession;

/**
 * Server-side fronting comment representation.
 * T1 encrypted: content
 * T3 plaintext: frontingSessionId, memberId
 */
export interface ServerFrontingComment extends AuditMetadata {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
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

/**
 * Server-side subsystem representation.
 * T1 encrypted: name, description, color, imageSource, emoji
 * T3 plaintext: parentSubsystemId, architectureType, hasCore, discoveryStatus
 */
export interface ServerSubsystem extends AuditMetadata {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly parentSubsystemId: SubsystemId | null;
  readonly architectureType: ArchitectureType | null;
  readonly hasCore: boolean;
  readonly discoveryStatus: DiscoveryStatus;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side subsystem — flat decrypted fields. */
export type ClientSubsystem = Subsystem;

/**
 * Server-side relationship representation.
 * T1 encrypted: label
 * T3 plaintext: type, sourceMemberId, targetMemberId, bidirectional
 *
 * Intentionally omits AuditMetadata — relationships are immutable entities
 * that are only created or deleted, never updated. Only createdAt is tracked.
 */
export interface ServerRelationship {
  readonly id: RelationshipId;
  readonly systemId: SystemId;
  readonly sourceMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly type: RelationshipType;
  readonly bidirectional: boolean;
  readonly createdAt: UnixMillis;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side relationship — flat decrypted fields. */
export type ClientRelationship = Relationship;

// ── Communication ──────────────────────────────────────────────

/**
 * Server-side channel representation.
 * T1 encrypted: name
 * T3 plaintext: type, parentId, sortOrder
 */
export interface ServerChannel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly type: "category" | "channel";
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side channel — flat decrypted fields. */
export type ClientChannel = Channel;

/**
 * Server-side chat message representation.
 * T1 encrypted: content, attachments, mentions
 * T3 plaintext: senderId, channelId, replyToId, timestamp, editedAt
 */
export interface ServerChatMessage extends AuditMetadata {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side chat message — flat decrypted fields. */
export type ClientChatMessage = ChatMessage;

/**
 * Server-side board message representation.
 * T1 encrypted: content
 * T3 plaintext: senderId, pinned, sortOrder
 */
export interface ServerBoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side board message — flat decrypted fields. */
export type ClientBoardMessage = BoardMessage;

/**
 * Server-side note representation.
 * T1 encrypted: title, content, backgroundColor
 */
export interface ServerNote extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side note — flat decrypted fields. */
export type ClientNote = Note;

// ── Custom fields ──────────────────────────────────────────────

/**
 * Server-side field definition representation.
 * T1 encrypted: name, description, options
 */
export interface ServerFieldDefinition extends AuditMetadata {
  readonly id: FieldDefinitionId;
  readonly systemId: SystemId;
  readonly fieldType: FieldType;
  readonly required: boolean;
  readonly sortOrder: number;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side field definition — flat decrypted fields. */
export type ClientFieldDefinition = FieldDefinition;

/**
 * Server-side field value representation.
 * T1 encrypted: value
 */
export interface ServerFieldValue extends AuditMetadata {
  readonly id: FieldValueId;
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly memberId: MemberId;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side field value — flat decrypted fields. */
export type ClientFieldValue = FieldValue;

// ── Innerworld ─────────────────────────────────────────────────

/**
 * Server-side innerworld entity representation.
 * T1 encrypted: name/linkedMemberId/linkedSubsystemId/linkedSideSystemId/linkedLayerId, description, visual
 */
export interface ServerInnerWorldEntity extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly positionX: number;
  readonly positionY: number;
  readonly regionId: InnerWorldRegionId | null;
  readonly entityType: "member" | "landmark" | "subsystem" | "side-system" | "layer";
  readonly encryptedData: EncryptedBlob;
}

/** Client-side innerworld entity — flat decrypted fields. */
export type ClientInnerWorldEntity = InnerWorldEntity;

/**
 * Server-side innerworld region representation.
 * T1 encrypted: name, description, boundaryData, visual
 */
export interface ServerInnerWorldRegion extends AuditMetadata {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly accessType: "open" | "gatekept";
  readonly gatekeeperMemberIds: readonly MemberId[];
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
  readonly id: EventId;
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
 * T1 encrypted: title, blocks, tags, linkedEntities
 * T3 plaintext: author, frontingSessionId, archived
 */
export interface ServerJournalEntry extends AuditMetadata {
  readonly id: JournalEntryId;
  readonly systemId: SystemId;
  readonly author: EntityReference<"member" | "subsystem" | "side-system" | "layer"> | null;
  readonly frontingSessionId: FrontingSessionId | null;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side journal entry — flat decrypted fields. */
export type ClientJournalEntry = JournalEntry;

/**
 * Server-side wiki page representation.
 * T1 encrypted: title, slug, blocks, tags, linkedEntities, linkedFromPages
 * T3 plaintext: archived
 */
export interface ServerWikiPage extends AuditMetadata {
  readonly id: WikiPageId;
  readonly systemId: SystemId;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side wiki page — flat decrypted fields. */
export type ClientWikiPage = WikiPage;

// ── Member photos ──────────────────────────────────────────────

/**
 * Server-side member photo representation.
 * T1 encrypted: imageSource, caption
 * T3 plaintext: memberId, sortOrder
 *
 * Intentionally omits AuditMetadata — photos are append-only gallery items.
 * The domain MemberPhoto type also omits it.
 */
export interface ServerMemberPhoto {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly sortOrder: number;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side member photo — flat decrypted fields. */
export type ClientMemberPhoto = MemberPhoto;

// ── Polls ──────────────────────────────────────────────────────

/**
 * Server-side poll representation.
 * T1 encrypted: title, options, description
 * T3 plaintext: createdByMemberId, kind, status, closedAt, endsAt,
 *   allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto
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
  readonly encryptedData: EncryptedBlob;
}

/** Client-side poll — flat decrypted fields. */
export type ClientPoll = Poll;

/**
 * Server-side poll vote representation.
 * T1 encrypted: comment
 * T3 plaintext: pollId, optionId, voter, isVeto, votedAt
 */
export interface ServerPollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "subsystem" | "side-system" | "layer">;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side poll vote — flat decrypted fields. */
export type ClientPollVote = PollVote;

// ── Acknowledgement requests ───────────────────────────────────

/**
 * Server-side acknowledgement request representation.
 * T1 encrypted: message
 * T3 plaintext: createdByMemberId, targetMemberId, confirmed, confirmedAt
 */
export interface ServerAcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side acknowledgement request — flat decrypted fields. */
export type ClientAcknowledgementRequest = AcknowledgementRequest;

// ── Side systems ───────────────────────────────────────────────

/**
 * Server-side side system representation.
 * T1 encrypted: name, description, color, imageSource, emoji
 */
export interface ServerSideSystem extends AuditMetadata {
  readonly id: SideSystemId;
  readonly systemId: SystemId;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side side system — flat decrypted fields. */
export type ClientSideSystem = SideSystem;

// ── Layers ─────────────────────────────────────────────────────

/**
 * Server-side layer representation.
 * T1 encrypted: name, description, color, imageSource, emoji
 * T3 plaintext: accessType, gatekeeperMemberIds
 */
export interface ServerLayer extends AuditMetadata {
  readonly id: LayerId;
  readonly systemId: SystemId;
  readonly accessType: "open" | "gatekept";
  readonly gatekeeperMemberIds: readonly MemberId[];
  readonly encryptedData: EncryptedBlob;
}

/** Client-side layer — flat decrypted fields. */
export type ClientLayer = Layer;

// ── Timer config ───────────────────────────────────────────────

/**
 * Server-side timer config representation.
 * T1 encrypted: promptText
 * T3 plaintext: intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, enabled
 */
export interface ServerTimerConfig extends AuditMetadata {
  readonly id: TimerId;
  readonly systemId: SystemId;
  readonly intervalMinutes: number;
  readonly wakingHoursOnly: boolean;
  readonly wakingStart: string;
  readonly wakingEnd: string;
  readonly enabled: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side timer config — flat decrypted fields. */
export type ClientTimerConfig = TimerConfig;

// ── Audit log ──────────────────────────────────────────────────

/**
 * Server-side audit log entry representation.
 * T1 encrypted: detail
 * T3 plaintext: eventType, actor, ipAddress, userAgent, createdAt
 */
export interface ServerAuditLogEntry {
  readonly id: AuditLogEntryId;
  readonly systemId: SystemId;
  readonly eventType: AuditEventType;
  readonly createdAt: UnixMillis;
  readonly actor: AuditActor;
  readonly encryptedData: EncryptedBlob | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/** Client-side audit log entry — flat decrypted fields. */
export type ClientAuditLogEntry = AuditLogEntry;

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: Uint8Array) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: Uint8Array) => ServerT;

// ── Tier map ───────────────────────────────────────────────────
//
// Member: T1 (name, pronouns, description, tags, colors, avatarSource, saturationLevel, suppressFriendFrontNotification, boardMessageNotificationOnFront) | T3 (archived)
// FrontingSession: T1 (comment, positionality) | T3 (timestamps, memberId, frontingType, customFrontId, linkedStructure)
// FrontingComment: T1 (content) | T3 (frontingSessionId, memberId) — extends AuditMetadata
// Group: T1 (name, description, imageSource, color, emoji) | T3 (sortOrder, archived, parentGroupId)
// Subsystem: T1 (name, description, color, imageSource, emoji) | T3 (parentSubsystemId, architectureType, hasCore, discoveryStatus)
// Relationship: T1 (label) | T3 (type, sourceMemberId, targetMemberId, bidirectional)
// Channel: T1 (name) | T3 (type, parentId, sortOrder)
// ChatMessage: T1 (content, attachments) | T3 (senderId, channelId, replyToId, timestamp, editedAt)
// BoardMessage: T1 (content) | T3 (senderId, pinned, sortOrder)
// Note: T1 (title, content, backgroundColor) | T3 (memberId)
// FieldDefinition: T1 (name, description, options) | T3 (fieldType, required, sortOrder)
// FieldValue: T1 (value) | T3 (fieldDefinitionId, memberId)
// InnerWorldEntity: T1 (linked entity refs, description, visual) | T3 (positionX/Y, regionId, entityType)
// InnerWorldRegion: T1 (name, description, boundaryData, visual) | T3 (parentRegionId, accessType, gatekeeperMemberIds)
// LifecycleEvent: T1 (notes) | T3 (eventType, occurredAt, recordedAt)
// CustomFront: T1 (name, description, color, emoji) | T3 (archived)
// JournalEntry: T1 (title, blocks, tags, linkedEntities) | T3 (author, frontingSessionId, archived)
// WikiPage: T1 (title, slug, blocks, tags, linkedEntities, linkedFromPages) | T3 (archived)
// MemberPhoto: T1 (imageSource, caption) | T3 (memberId, sortOrder)
// Poll: T1 (title, options, description) | T3 (createdByMemberId, kind, status, closedAt, endsAt, allowMultipleVotes, maxVotesPerMember, allowAbstain, allowVeto)
// PollVote: T1 (comment) | T3 (pollId, optionId, voter, isVeto, votedAt)
// AcknowledgementRequest: T1 (message) | T3 (createdByMemberId, targetMemberId, confirmed, confirmedAt)
// SideSystem: T1 (name, description, color, imageSource, emoji) | T3 (none)
// Layer: T1 (name, description, color, imageSource, emoji) | T3 (accessType, gatekeeperMemberIds)
// TimerConfig: T1 (promptText) | T3 (intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd, enabled)
// AuditLogEntry: T1 (detail) | T3 (eventType, actor, ipAddress, userAgent, createdAt)
//
// ApiKey: T3 (all fields — server metadata, no user content)
// BlobMetadata: T3 (all fields — metadata only, blob content encrypted at storage layer)
// JobDefinition: T3 (all fields — server-internal job metadata)
// DeviceToken: T1 (token) | T3 (platform, lastActiveAt)
// NotificationConfig: T3 (all fields — user preferences, no sensitive content)
// NotificationPayload: T1 (title, body, data) | T3 (eventType, systemId)
// WebhookConfig: T1 (secret via EncryptedString) | T3 (url, eventTypes, enabled, cryptoKeyId)
// WebhookDelivery: T1 (payload when encrypted) | T3 (eventType, statusCode, deliveredAt, success)
// RealtimeSubscription: T3 (all fields — subscription metadata)
// SearchQuery/SearchResult: client-only types, not persisted server-side
