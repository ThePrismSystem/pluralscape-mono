import type { EncryptedSnapshotEnvelope } from "../types.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type {
  BoardMessageId,
  BucketId,
  CheckInRecordId,
  FieldDefinitionId,
  FieldValueId,
  FriendCodeId,
  FriendConnectionId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  InnerWorldRegionId,
  JournalEntryId,
  KeyGrantId,
  LifecycleEventId,
  MemberId,
  NoteId,
  SyncDocumentId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  TimerId,
} from "@pluralscape/types";

// Cast test values to branded types — these are contract test fixtures,
// not real cryptographic material.
export function asSyncDocId(id: string): SyncDocumentId {
  return id as SyncDocumentId;
}
export function sysId(id: string): SystemId {
  return id as SystemId;
}
export function asBoardMessageId(id: string): BoardMessageId {
  return id as BoardMessageId;
}
export function asBucketId(id: string): BucketId {
  return id as BucketId;
}
export function asMemberId(id: string): MemberId {
  return id as MemberId;
}
export function asGroupId(id: string): GroupId {
  return id as GroupId;
}
export function asFrontingSessionId(id: string): FrontingSessionId {
  return id as FrontingSessionId;
}
export function asTimerId(id: string): TimerId {
  return id as TimerId;
}
export function asCheckInRecordId(id: string): CheckInRecordId {
  return id as CheckInRecordId;
}
export function asKeyGrantId(id: string): KeyGrantId {
  return id as KeyGrantId;
}
export function asLifecycleEventId(id: string): LifecycleEventId {
  return id as LifecycleEventId;
}
export function asJournalEntryId(id: string): JournalEntryId {
  return id as JournalEntryId;
}
export function asFieldDefinitionId(id: string): FieldDefinitionId {
  return id as FieldDefinitionId;
}
export function asFieldValueId(id: string): FieldValueId {
  return id as FieldValueId;
}
export function asNoteId(id: string): NoteId {
  return id as NoteId;
}
export function asInnerWorldRegionId(id: string): InnerWorldRegionId {
  return id as InnerWorldRegionId;
}
export function asSystemStructureEntityLinkId(id: string): SystemStructureEntityLinkId {
  return id as SystemStructureEntityLinkId;
}
export function asSystemStructureEntityMemberLinkId(id: string): SystemStructureEntityMemberLinkId {
  return id as SystemStructureEntityMemberLinkId;
}
export function asSystemStructureEntityAssociationId(
  id: string,
): SystemStructureEntityAssociationId {
  return id as SystemStructureEntityAssociationId;
}
export function asFriendCodeId(id: string): FriendCodeId {
  return id as FriendCodeId;
}
export function asFriendConnectionId(id: string): FriendConnectionId {
  return id as FriendConnectionId;
}
export function asFrontingCommentId(id: string): FrontingCommentId {
  return id as FrontingCommentId;
}

export function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}
export function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}
export function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

export function makeSnapshot(
  version: number,
  documentId: SyncDocumentId,
): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion: version,
    ciphertext: new Uint8Array([10, 20, 30, version]),
    nonce: nonce(version),
    signature: sig(3),
    authorPublicKey: pubkey(1),
  };
}
