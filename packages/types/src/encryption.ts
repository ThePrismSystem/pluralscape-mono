import type { FrontingSession, FrontingType } from "./fronting.js";
import type { Group } from "./groups.js";
import type { CompletenessLevel } from "./identity.js";
import type {
  BucketId,
  CustomFrontId,
  FrontingSessionId,
  GroupId,
  MemberId,
  RelationshipId,
  SubsystemId,
  SystemId,
} from "./ids.js";
import type { RelationshipType, Relationship, Subsystem } from "./structure.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

// ── Tier wrappers ──────────────────────────────────────────────

declare const __encTier: unique symbol;

/** T1 zero-knowledge: wrapped value cannot be read by the server. */
export type Encrypted<T> = T & { readonly [__encTier]: 1 };

/** T2 per-bucket: wrapped value is encrypted with a bucket key for friend sharing. */
export type BucketEncrypted<T> = T & { readonly [__encTier]: 2 };

/** T3 passthrough: identity type for explicit tier annotation. No wrapping. */
export type Plaintext<T> = T;

// ── EncryptedBlob ──────────────────────────────────────────────

/** Wire format for encrypted data. Carried in server-side entity representations. */
export interface EncryptedBlob {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly tier: 1 | 2;
  readonly algorithm: string;
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

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: Uint8Array) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: Uint8Array) => ServerT;

// ── Tier map (partial — completed types only) ──────────────────
//
// Member: T1 (name, pronouns, description, roleTags, colors, avatarRef) | T3 (completenessLevel, archived)
// FrontingSession: T1 (comment) | T3 (timestamps, memberId, frontingType, customFrontId, subsystemId)
// Group: T1 (name, description, imageRef, color, emoji) | T3 (sortOrder, archived, parentGroupId)
// Subsystem: T1 (name, description) | T3 (parentSubsystemId)
// Relationship: T1 (label) | T3 (type, sourceMemberId, targetMemberId, bidirectional)
//
// TODO: Add communication types when types-8klm is completed
// TODO: Add custom field types when types-0jjx is completed
// TODO: Add innerworld types when types-iz5j is completed
// TODO: Add lifecycle event types when types-296i is completed
