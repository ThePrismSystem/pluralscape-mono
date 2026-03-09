import type { Channel, ChatMessage, BoardMessage, Note } from "./communication.js";
import type { FieldDefinition, FieldValue } from "./custom-fields.js";
import type { FrontingSession, FrontingType } from "./fronting.js";
import type { Group } from "./groups.js";
import type { CompletenessLevel } from "./identity.js";
import type {
  BucketId,
  ChannelId,
  CustomFrontId,
  EventId,
  FrontingSessionId,
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  RelationshipId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { InnerWorldEntity, InnerWorldRegion } from "./innerworld.js";
import type { LifecycleEvent } from "./lifecycle.js";
import type { RelationshipType, Relationship, Subsystem } from "./structure.js";
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
 * T1 encrypted: name, pronouns, description, roleTags, colors, avatarRef
 * T3 plaintext: completenessLevel, archived
 */
export interface ServerMember extends AuditMetadata {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly completenessLevel: CompletenessLevel;
  readonly archived: boolean;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side member — flat decrypted fields. Identical to the domain Member type. */
export type ClientMember = import("./identity.js").Member;

/**
 * Server-side fronting session representation.
 * T1 encrypted: comment
 * T3 plaintext: timestamps, memberId, frontingType, customFrontId, subsystemId
 */
export interface ServerFrontingSession extends AuditMetadata {
  readonly id: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId;
  readonly startTime: UnixMillis;
  readonly endTime: UnixMillis | null;
  readonly frontingType: FrontingType;
  readonly customFrontId: CustomFrontId | null;
  readonly subsystemId: SubsystemId | null;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side fronting session — flat decrypted fields. */
export type ClientFrontingSession = FrontingSession;

/**
 * Server-side group representation.
 * T1 encrypted: name, description, imageRef, color, emoji
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
 * T1 encrypted: name, description
 * T3 plaintext: parentSubsystemId
 */
export interface ServerSubsystem extends AuditMetadata {
  readonly id: SubsystemId;
  readonly systemId: SystemId;
  readonly parentSubsystemId: SubsystemId | null;
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
 */
export interface ServerChannel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly type: "category" | "channel";
  readonly sortOrder: number;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side channel — flat decrypted fields. */
export type ClientChannel = Channel;

/**
 * Server-side chat message representation.
 * T1 encrypted: content, attachments
 */
export interface ServerChatMessage extends AuditMetadata {
  readonly id: import("./ids.js").MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly replyToId: import("./ids.js").MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side chat message — flat decrypted fields. */
export type ClientChatMessage = ChatMessage;

/**
 * Server-side board message representation.
 * T1 encrypted: content
 */
export interface ServerBoardMessage extends AuditMetadata {
  readonly id: import("./ids.js").BoardMessageId;
  readonly systemId: SystemId;
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
  readonly id: import("./ids.js").NoteId;
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
  readonly id: import("./ids.js").FieldDefinitionId;
  readonly systemId: SystemId;
  readonly fieldType: import("./custom-fields.js").FieldType;
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
  readonly id: import("./ids.js").FieldValueId;
  readonly fieldDefinitionId: import("./ids.js").FieldDefinitionId;
  readonly memberId: MemberId;
  readonly encryptedData: EncryptedBlob;
}

/** Client-side field value — flat decrypted fields. */
export type ClientFieldValue = FieldValue;

// ── Innerworld ─────────────────────────────────────────────────

/**
 * Server-side innerworld entity representation.
 * T1 encrypted: name/linkedMemberId, description, visual
 */
export interface ServerInnerWorldEntity extends AuditMetadata {
  readonly id: InnerWorldEntityId;
  readonly systemId: SystemId;
  readonly positionX: number;
  readonly positionY: number;
  readonly regionId: InnerWorldRegionId | null;
  readonly entityType: "member" | "landmark";
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
  readonly gatekeeperMemberId: MemberId | null;
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
  readonly eventType: import("./lifecycle.js").LifecycleEventType;
  readonly occurredAt: UnixMillis;
  readonly recordedAt: UnixMillis;
  readonly encryptedData: EncryptedBlob | null;
}

/** Client-side lifecycle event — flat decrypted fields. */
export type ClientLifecycleEvent = LifecycleEvent;

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: Uint8Array) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: Uint8Array) => ServerT;

// ── Tier map ───────────────────────────────────────────────────
//
// Member: T1 (name, pronouns, description, roleTags, colors, avatarRef) | T3 (completenessLevel, archived)
// FrontingSession: T1 (comment) | T3 (timestamps, memberId, frontingType, customFrontId, subsystemId)
// Group: T1 (name, description, imageRef, color, emoji) | T3 (sortOrder, archived, parentGroupId)
// Subsystem: T1 (name, description) | T3 (parentSubsystemId)
// Relationship: T1 (label) | T3 (type, sourceMemberId, targetMemberId, bidirectional)
// Channel: T1 (name) | T3 (type, sortOrder)
// ChatMessage: T1 (content, attachments) | T3 (senderId, channelId, replyToId, timestamp, editedAt)
// BoardMessage: T1 (content) | T3 (pinned, sortOrder)
// Note: T1 (title, content, backgroundColor) | T3 (memberId)
// FieldDefinition: T1 (name, description, options) | T3 (fieldType, required, sortOrder)
// FieldValue: T1 (value) | T3 (fieldDefinitionId, memberId)
// InnerWorldEntity: T1 (name/linkedMemberId, description, visual) | T3 (positionX/Y, regionId, entityType)
// InnerWorldRegion: T1 (name, description, boundaryData, visual) | T3 (parentRegionId, accessType, gatekeeperMemberId)
// LifecycleEvent: T1 (notes) | T3 (eventType, occurredAt, recordedAt)
//
// ApiKey: T3 (all fields — server metadata, no user content)
// AuditLogEntry: T1 (detail) | T3 (eventType, actor, ipAddress, userAgent, createdAt)
// BlobMetadata: T3 (all fields — metadata only, blob content encrypted at storage layer)
// JobDefinition: T3 (all fields — server-internal job metadata)
// DeviceToken: T1 (token) | T3 (platform, lastActiveAt)
// NotificationConfig: T3 (all fields — user preferences, no sensitive content)
// NotificationPayload: T1 (title, body, data) | T3 (eventType, systemId)
// WebhookConfig: T1 (secret via EncryptedString) | T3 (url, eventTypes, enabled)
// WebhookDelivery: T1 (payload when encrypted) | T3 (eventType, statusCode, deliveredAt, success)
// RealtimeSubscription: T3 (all fields — subscription metadata)
// SearchQuery/SearchResult: client-only types, not persisted server-side
