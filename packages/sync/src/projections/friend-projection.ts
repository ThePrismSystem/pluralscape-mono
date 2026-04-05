import { ImmutableString } from "@automerge/automerge";

import type {
  CrdtFriendCode,
  CrdtFriendConnection,
  CrdtKeyGrant,
} from "../schemas/privacy-config.js";
import type { PrivacyConfigDocument } from "../schemas/privacy-config.js";
import type {
  AccountId,
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  FriendConnectionStatus,
  KeyGrantId,
  Logger,
} from "@pluralscape/types";

// ── input types ──────────────────────────────────────────────────────

/** Service-layer input for projecting a friend code into CRDT format. */
export interface FriendCodeInput {
  readonly id: FriendCodeId;
  readonly accountId: AccountId;
  readonly code: string;
  readonly createdAt: number;
  readonly expiresAt: number | null;
}

/** Service-layer input for projecting a friend connection into CRDT format. */
export interface FriendConnectionInput {
  readonly id: FriendConnectionId;
  readonly accountId: AccountId;
  readonly friendAccountId: AccountId;
  readonly status: FriendConnectionStatus;
  /** JSON-serialized FriendVisibilitySettings. */
  readonly visibility: string;
  readonly assignedBucketIds: readonly BucketId[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Service-layer input for projecting a key grant into CRDT format. */
export interface KeyGrantInput {
  readonly id: KeyGrantId;
  readonly bucketId: BucketId;
  readonly friendAccountId: AccountId;
  /** Base64-encoded encrypted bucket key. */
  readonly encryptedBucketKey: string;
  readonly keyVersion: number;
  readonly createdAt: number;
}

// ── helpers ──────────────────────────────────────────────────────────

/** Create an ImmutableString (whole-value LWW) from a plain string. */
function immStr(val: string): ImmutableString {
  return new ImmutableString(val);
}

/**
 * Convert an array of bucket IDs into the CRDT add-wins map format.
 * Each bucket ID becomes a key mapped to `true`.
 */
function bucketArrayToMap(bucketIds: readonly BucketId[]): Record<BucketId, true> {
  return Object.fromEntries(bucketIds.map((id) => [id, true])) as Record<BucketId, true>;
}

// ── pure projection functions ────────────────────────────────────────

/** Project a friend code into the CRDT document format. */
export function projectFriendCode(code: FriendCodeInput): CrdtFriendCode {
  return {
    id: immStr(code.id),
    accountId: immStr(code.accountId),
    code: immStr(code.code),
    createdAt: code.createdAt,
    expiresAt: code.expiresAt,
    archived: false,
  };
}

/** Project a friend connection into the CRDT document format. */
export function projectFriendConnection(connection: FriendConnectionInput): CrdtFriendConnection {
  return {
    id: immStr(connection.id),
    accountId: immStr(connection.accountId),
    friendAccountId: immStr(connection.friendAccountId),
    status: immStr(connection.status),
    assignedBuckets: bucketArrayToMap(connection.assignedBucketIds),
    visibility: immStr(connection.visibility),
    archived: false,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

/** Project a key grant into the CRDT document format. */
export function projectKeyGrant(grant: KeyGrantInput): CrdtKeyGrant {
  return {
    id: immStr(grant.id),
    bucketId: immStr(grant.bucketId),
    friendAccountId: immStr(grant.friendAccountId),
    encryptedBucketKey: immStr(grant.encryptedBucketKey),
    keyVersion: grant.keyVersion,
    createdAt: grant.createdAt,
    revokedAt: null,
  };
}

// ── document mutation projections ────────────────────────────────────

/** Apply a friend code projection to a PrivacyConfigDocument. */
export function applyFriendCodeProjection(doc: PrivacyConfigDocument, code: FriendCodeInput): void {
  doc.friendCodes[code.id] = projectFriendCode(code);
}

/** Apply a friend connection projection to a PrivacyConfigDocument. */
export function applyFriendConnectionProjection(
  doc: PrivacyConfigDocument,
  connection: FriendConnectionInput,
): void {
  doc.friendConnections[connection.id] = projectFriendConnection(connection);
}

/** Apply a key grant projection to a PrivacyConfigDocument. */
export function applyKeyGrantProjection(doc: PrivacyConfigDocument, grant: KeyGrantInput): void {
  doc.keyGrants[grant.id] = projectKeyGrant(grant);
}

/** Mark a friend code as archived in the CRDT document. */
export function archiveFriendCodeProjection(
  doc: PrivacyConfigDocument,
  codeId: FriendCodeId,
  logger?: Pick<Logger, "warn">,
): void {
  const code = doc.friendCodes[codeId];
  if (code) {
    code.archived = true;
  } else {
    logger?.warn("archiveFriendCodeProjection: code not found", { codeId });
  }
}

/** Update friend connection status in the CRDT document. */
export function updateFriendConnectionStatusProjection(
  doc: PrivacyConfigDocument,
  connectionId: FriendConnectionId,
  status: FriendConnectionStatus,
  updatedAt: number,
  logger?: Pick<Logger, "warn">,
): void {
  const connection = doc.friendConnections[connectionId];
  if (connection) {
    connection.status = immStr(status);
    connection.updatedAt = updatedAt;
  } else {
    logger?.warn("updateFriendConnectionStatusProjection: connection not found", { connectionId });
  }
}

/** Update friend connection visibility in the CRDT document. */
export function updateFriendConnectionVisibilityProjection(
  doc: PrivacyConfigDocument,
  connectionId: FriendConnectionId,
  visibility: string,
  updatedAt: number,
  logger?: Pick<Logger, "warn">,
): void {
  const connection = doc.friendConnections[connectionId];
  if (connection) {
    connection.visibility = immStr(visibility);
    connection.updatedAt = updatedAt;
  } else {
    logger?.warn("updateFriendConnectionVisibilityProjection: connection not found", {
      connectionId,
    });
  }
}

/** Add bucket assignment to friend connection in the CRDT document. */
export function addBucketAssignmentProjection(
  doc: PrivacyConfigDocument,
  connectionId: FriendConnectionId,
  bucketId: BucketId,
  updatedAt: number,
  logger?: Pick<Logger, "warn">,
): void {
  const connection = doc.friendConnections[connectionId];
  if (connection) {
    connection.assignedBuckets[bucketId] = true;
    connection.updatedAt = updatedAt;
  } else {
    logger?.warn("addBucketAssignmentProjection: connection not found", { connectionId });
  }
}

/** Remove bucket assignment from friend connection in the CRDT document. */
export function removeBucketAssignmentProjection(
  doc: PrivacyConfigDocument,
  connectionId: FriendConnectionId,
  bucketId: BucketId,
  updatedAt: number,
  logger?: Pick<Logger, "warn">,
): void {
  const connection = doc.friendConnections[connectionId];
  if (connection) {
    Reflect.deleteProperty(connection.assignedBuckets, bucketId);
    connection.updatedAt = updatedAt;
  } else {
    logger?.warn("removeBucketAssignmentProjection: connection not found", { connectionId });
  }
}

/** Mark a friend connection as archived in the CRDT document. */
export function archiveFriendConnectionProjection(
  doc: PrivacyConfigDocument,
  connectionId: FriendConnectionId,
  logger?: Pick<Logger, "warn">,
): void {
  const connection = doc.friendConnections[connectionId];
  if (connection) {
    connection.archived = true;
  } else {
    logger?.warn("archiveFriendConnectionProjection: connection not found", { connectionId });
  }
}

/** Revoke a key grant in the CRDT document. */
export function revokeKeyGrantProjection(
  doc: PrivacyConfigDocument,
  grantId: KeyGrantId,
  revokedAt: number,
  logger?: Pick<Logger, "warn">,
): void {
  const grant = doc.keyGrants[grantId];
  if (grant) {
    grant.revokedAt = revokedAt;
  } else {
    logger?.warn("revokeKeyGrantProjection: grant not found", { grantId });
  }
}
