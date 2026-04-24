import type { KdfMasterKey } from "./crypto-keys.js";
import type { AcknowledgementRequest } from "./entities/acknowledgement.js";
import type { BoardMessage } from "./entities/board-message.js";
import type { Channel } from "./entities/channel.js";
import type { FieldDefinition, FieldType } from "./entities/field-definition.js";
import type { FieldValue } from "./entities/field-value.js";
import type { FrontingComment } from "./entities/fronting-comment.js";
import type { FrontingSession } from "./entities/fronting-session.js";
import type { InnerWorldEntity } from "./entities/innerworld-entity.js";
import type { InnerWorldRegion } from "./entities/innerworld-region.js";
import type { JournalEntry } from "./entities/journal-entry.js";
import type { LifecycleEvent, LifecycleEventType } from "./entities/lifecycle-event.js";
import type { ChatMessage } from "./entities/message.js";
import type { Note, NoteAuthorEntityType } from "./entities/note.js";
import type { PollVote } from "./entities/poll-vote.js";
import type { Poll, PollKind, PollStatus } from "./entities/poll.js";
import type { RelationshipType, Relationship } from "./entities/relationship.js";
import type { SystemStructureEntityType } from "./entities/structure-entity-type.js";
import type { SystemStructureEntity } from "./entities/structure-entity.js";
import type { TimerConfig } from "./entities/timer-config.js";
import type { WikiPage } from "./entities/wiki-page.js";
import type {
  AcknowledgementId,
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

export declare const __plaintext: unique symbol;

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

// ── ServerSecret ───────────────────────────────────────────────

declare const __serverSecret: unique symbol;

/**
 * Branded type for server-held HMAC signing secrets. These are raw binary keys
 * the server reads to sign webhook deliveries — NOT E2E encrypted data.
 */
export type ServerSecret = Uint8Array & { readonly [__serverSecret]: true };

// ── Server/Client variant pattern ──────────────────────────────
// Server types carry EncryptedBlob; Client types have flat decrypted fields.
// Only defined for completed domain modules.
// MemberServerMetadata / MemberWire live in entities/member.ts.
// AuditLogEntryServerMetadata / AuditLogEntryWire live in entities/audit-log-entry.ts.

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
 * T3 plaintext: authorEntityType, authorEntityId, archived
 */
export interface ServerNote extends AuditMetadata {
  readonly id: NoteId;
  readonly systemId: SystemId;
  readonly authorEntityType: NoteAuthorEntityType | null;
  readonly authorEntityId: string | null;
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
  readonly updatedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob | null;
  readonly plaintextMetadata: Record<string, unknown> | null;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

/** Client-side lifecycle event — flat decrypted fields. */
export type ClientLifecycleEvent = LifecycleEvent;

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

// ── Polls ──────────────────────────────────────────────────────

/**
 * Server-side poll representation.
 * T1 encrypted: title, options, description
 */
export interface ServerPoll extends AuditMetadata {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly kind: PollKind;
  readonly status: PollStatus;
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

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: KdfMasterKey) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: KdfMasterKey) => ServerT;
