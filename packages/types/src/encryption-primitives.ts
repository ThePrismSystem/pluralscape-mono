import type { KdfMasterKey } from "./crypto-keys.js";
import type { CustomFront } from "./entities/custom-front.js";
import type { FieldDefinition, FieldType } from "./entities/field-definition.js";
import type { FieldValue } from "./entities/field-value.js";
import type { FrontingComment } from "./entities/fronting-comment.js";
import type { FrontingSession } from "./entities/fronting-session.js";
import type { Group } from "./entities/group.js";
import type { LifecycleEvent, LifecycleEventType } from "./entities/lifecycle-event.js";
import type { MemberPhoto } from "./entities/member-photo.js";
import type { RelationshipType, Relationship } from "./entities/relationship.js";
import type { SystemStructureEntityType } from "./entities/structure-entity-type.js";
import type { SystemStructureEntity } from "./entities/structure-entity.js";
import type {
  BucketId,
  CustomFrontId,
  LifecycleEventId,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  MemberId,
  MemberPhotoId,
  RelationshipId,
  SystemId,
  SystemStructureEntityTypeId,
  SystemStructureEntityId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

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
// Channel / ChatMessage / BoardMessage / Note ServerMetadata + Wire types
// live in their respective entity files (channel.ts, message.ts,
// board-message.ts, note.ts).

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

// JournalEntry / WikiPage ServerMetadata + Wire types live in their
// respective entity files (journal-entry.ts, wiki-page.ts).

// ── Member photos ──────────────────────────────────────────────

/**
 * Server-side member photo representation.
 * T1 encrypted: imageSource, caption
 * T3 plaintext: memberId, sortOrder, archived
 *
 * Intentionally omits AuditMetadata — photos are append-only gallery items.
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

// ── Polls + Acknowledgement + Timer ────────────────────────────
// Poll / PollVote / AcknowledgementRequest / TimerConfig ServerMetadata +
// Wire types live in their respective entity files (poll.ts, poll-vote.ts,
// acknowledgement.ts, timer-config.ts).

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: KdfMasterKey) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: KdfMasterKey) => ServerT;
