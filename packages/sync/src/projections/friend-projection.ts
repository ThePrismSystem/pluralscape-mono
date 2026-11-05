import { ImmutableString } from "@automerge/automerge";

import type {
  CrdtFriendCode,
  CrdtFriendConnection,
  CrdtKeyGrant,
  PrivacyConfigDocument,
} from "../schemas/privacy-config.js";
import type {
  KeyGrantProjectionSource,
  FriendConnectionProjectionSource,
  FriendCodeProjectionSource,
  BucketId,
  FriendCodeId,
  FriendConnectionId,
  FriendConnectionStatus,
  KeyGrantId,
  Logger,
} from "@pluralscape/types";

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
  return Object.fromEntries(bucketIds.map((id) => [id, true]));
}

// ── pure projection functions ────────────────────────────────────────

/** Project a friend code into the CRDT document format. */
export function projectFriendCode(code: FriendCodeProjectionSource): CrdtFriendCode {
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
export function projectFriendConnection(
  connection: FriendConnectionProjectionSource,
): CrdtFriendConnection {
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
export function projectKeyGrant(grant: KeyGrantProjectionSource): CrdtKeyGrant {
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
export function applyFriendCodeProjection(
  doc: PrivacyConfigDocument,
  code: FriendCodeProjectionSource,
): void {
  doc.friendCodes[code.id] = projectFriendCode(code);
}

/** Apply a friend connection projection to a PrivacyConfigDocument. */
export function applyFriendConnectionProjection(
  doc: PrivacyConfigDocument,
  connection: FriendConnectionProjectionSource,
): void {
  doc.friendConnections[connection.id] = projectFriendConnection(connection);
}

/** Apply a key grant projection to a PrivacyConfigDocument. */
export function applyKeyGrantProjection(
  doc: PrivacyConfigDocument,
  grant: KeyGrantProjectionSource,
): void {
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
