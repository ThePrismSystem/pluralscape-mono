import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";
import type {
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  KeyGrantId,
  TaggedEntityRef,
} from "@pluralscape/types";

// ── privacy bucket ────────────────────────────────────────────────────

/** CRDT representation of a PrivacyBucket definition (LWW map, keyed by BucketId). */
export interface CrdtPrivacyBucket extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  archived: boolean;
}

// ── bucket content tag ────────────────────────────────────────────────

/**
 * CRDT representation of a BucketContentTag (LWW map).
 *
 * Key format: "{entityType}_{entityId}_{bucketId}"; deleting the key
 * removes the entity-bucket assignment. Wire format unchanged from the
 * pre-discriminated-union schema.
 */
export type CrdtBucketContentTag = TaggedEntityRef & { bucketId: CrdtString };

// ── friend connection ─────────────────────────────────────────────────

/**
 * CRDT representation of a FriendConnection (LWW map, keyed by FriendConnectionId).
 *
 * assignedBuckets uses a nested map (Record<string, true>) instead of the domain
 * type's array — this gives natural deduplication and add-wins CRDT semantics for
 * concurrent bucket assignment changes (topology correction from v1 spec).
 */
export interface CrdtFriendConnection extends CrdtAuditFields {
  id: CrdtString;
  accountId: CrdtString;
  friendAccountId: CrdtString;
  /** FriendConnectionStatus string */
  status: CrdtString;
  /**
   * Nested map keyed by BucketId → true.
   * Add-wins: concurrent add+remove results in the bucket being assigned.
   */
  assignedBuckets: Record<BucketId, true>;
  /** JSON-serialized FriendVisibilitySettings */
  visibility: CrdtString;
  archived: boolean;
}

// ── friend code ───────────────────────────────────────────────────────

/** CRDT representation of a FriendCode (LWW map, keyed by FriendCodeId). */
export interface CrdtFriendCode {
  id: CrdtString;
  accountId: CrdtString;
  code: CrdtString;
  createdAt: number;
  expiresAt: number | null;
  archived: boolean;
}

// ── key grant ─────────────────────────────────────────────────────────

/**
 * CRDT representation of a KeyGrant (append-lww map, keyed by KeyGrantId).
 * Created once when granting access; revokedAt is the only mutable field.
 * Concurrent revocations all result in a revoked state (safe from security perspective).
 */
export interface CrdtKeyGrant {
  id: CrdtString;
  bucketId: CrdtString;
  friendAccountId: CrdtString;
  /** Base64-encoded encrypted bucket key (Uint8Array serialized for CRDT storage). */
  encryptedBucketKey: CrdtString;
  keyVersion: number;
  createdAt: number;
  /** LWW — set on revocation. Null while grant is active. */
  revokedAt: number | null;
}

// ── document ─────────────────────────────────────────────────────────

/**
 * Automerge document schema for the privacy-config document.
 *
 * Contains all privacy configuration — bucket definitions, content tags,
 * friend connections, friend codes, and key grants.
 *
 * Encryption key: Master key
 * Naming: privacy-config-{systemId}
 */
export interface PrivacyConfigDocument {
  /** LWW map keyed by BucketId. */
  buckets: Record<BucketId, CrdtPrivacyBucket>;
  /**
   * LWW map keyed by compound key "{entityType}_{entityId}_{bucketId}".
   * Deleting a key removes the entity-bucket assignment.
   */
  contentTags: Record<string, CrdtBucketContentTag>;
  /** LWW map keyed by FriendConnectionId (with nested assignedBuckets map). */
  friendConnections: Record<FriendConnectionId, CrdtFriendConnection>;
  /** LWW map keyed by FriendCodeId. */
  friendCodes: Record<FriendCodeId, CrdtFriendCode>;
  /** Append-lww map keyed by KeyGrantId; revokedAt is the only mutable field. */
  keyGrants: Record<KeyGrantId, CrdtKeyGrant>;
  /**
   * Junction map keyed by "{fieldDefinitionId}_{bucketId}" → true.
   * Controls which custom field definitions are visible in each bucket.
   * Missing on documents created before this field was added — treat as empty.
   */
  fieldBucketVisibility?: Record<string, true>;
}
