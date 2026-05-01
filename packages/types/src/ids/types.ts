import type { Brand } from "./brand.js";

// ── Branded ID types ────────────────────────────────────────────────

export type SystemId = Brand<string, "SystemId">;
export type MemberId = Brand<string, "MemberId">;
export type GroupId = Brand<string, "GroupId">;
/** Compound junction key for group memberships, format: "{groupId}_{memberId}". */
export type GroupMembershipKey = Brand<string, "GroupMembershipKey">;
export type BucketId = Brand<string, "BucketId">;
export type ChannelId = Brand<string, "ChannelId">;
export type MessageId = Brand<string, "MessageId">;
export type NoteId = Brand<string, "NoteId">;
export type PollId = Brand<string, "PollId">;
export type RelationshipId = Brand<string, "RelationshipId">;
export type SystemStructureEntityTypeId = Brand<string, "SystemStructureEntityTypeId">;
export type SystemStructureEntityId = Brand<string, "SystemStructureEntityId">;
export type SystemStructureEntityLinkId = Brand<string, "SystemStructureEntityLinkId">;
export type SystemStructureEntityMemberLinkId = Brand<string, "SystemStructureEntityMemberLinkId">;
export type SystemStructureEntityAssociationId = Brand<
  string,
  "SystemStructureEntityAssociationId"
>;
export type FieldDefinitionId = Brand<string, "FieldDefinitionId">;
export type FieldDefinitionScopeId = Brand<string, "FieldDefinitionScopeId">;
export type FieldValueId = Brand<string, "FieldValueId">;
export type SessionId = Brand<string, "SessionId">;
export type LifecycleEventId = Brand<string, "LifecycleEventId">;
export type AccountId = Brand<string, "AccountId">;
export type BlobId = Brand<string, "BlobId">;
export type ApiKeyId = Brand<string, "ApiKeyId">;
export type WebhookId = Brand<string, "WebhookId">;
export type TimerId = Brand<string, "TimerId">;
export type JournalEntryId = Brand<string, "JournalEntryId">;
export type WikiPageId = Brand<string, "WikiPageId">;
export type InnerWorldEntityId = Brand<string, "InnerWorldEntityId">;
export type InnerWorldRegionId = Brand<string, "InnerWorldRegionId">;
export type InnerWorldCanvasId = Brand<string, "InnerWorldCanvasId">;
export type AuditLogEntryId = Brand<string, "AuditLogEntryId">;
export type BoardMessageId = Brand<string, "BoardMessageId">;
export type AcknowledgementId = Brand<string, "AcknowledgementId">;
export type CheckInRecordId = Brand<string, "CheckInRecordId">;
export type FriendConnectionId = Brand<string, "FriendConnectionId">;
export type KeyGrantId = Brand<string, "KeyGrantId">;
export type FrontingSessionId = Brand<string, "FrontingSessionId">;
export type CustomFrontId = Brand<string, "CustomFrontId">;
export type FriendCodeId = Brand<string, "FriendCodeId">;
export type PollVoteId = Brand<string, "PollVoteId">;
export type DeviceTokenId = Brand<string, "DeviceTokenId">;
export type NotificationConfigId = Brand<string, "NotificationConfigId">;
export type SystemSettingsId = Brand<string, "SystemSettingsId">;
export type PollOptionId = Brand<string, "PollOptionId">;
export type MemberPhotoId = Brand<string, "MemberPhotoId">;
export type AuthKeyId = Brand<string, "AuthKeyId">;
export type RecoveryKeyId = Brand<string, "RecoveryKeyId">;
export type DeviceTransferRequestId = Brand<string, "DeviceTransferRequestId">;
export type SyncDocumentId = Brand<string, "SyncDocumentId">;
export type SyncChangeId = Brand<string, "SyncChangeId">;
export type SyncSnapshotId = Brand<string, "SyncSnapshotId">;
export type ImportJobId = Brand<string, "ImportJobId">;
export type ImportEntityRefId = Brand<string, "ImportEntityRefId">;
export type PKBridgeConfigId = Brand<string, "PKBridgeConfigId">;
export type AccountPurgeRequestId = Brand<string, "AccountPurgeRequestId">;
export type ExportRequestId = Brand<string, "ExportRequestId">;
export type JobId = Brand<string, "JobId">;
/** In-memory WebSocket subscription — not a persisted entity, has no ID_PREFIXES entry. */
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type WebhookDeliveryId = Brand<string, "WebhookDeliveryId">;
export type FrontingReportId = Brand<string, "FrontingReportId">;
export type FriendNotificationPreferenceId = Brand<string, "FriendNotificationPreferenceId">;
export type FrontingCommentId = Brand<string, "FrontingCommentId">;
export type BucketKeyRotationId = Brand<string, "BucketKeyRotationId">;
export type BucketRotationItemId = Brand<string, "BucketRotationItemId">;
export type SystemSnapshotId = Brand<string, "SystemSnapshotId">;
export type BiometricTokenId = Brand<string, "BiometricTokenId">;
export type SafeModeContentId = Brand<string, "SafeModeContentId">;
export type StorageKey = Brand<string, "StorageKey">;
export type HexColor = Brand<string, "HexColor">;
export type SlugHash = Brand<string, "SlugHash">;

/**
 * Union of every branded string ID type published by this module. Consumed by
 * `packages/db/src/columns/pg.ts`'s `brandedId<B>()` helper to constrain the
 * generic parameter to a known brand, so authors can't accidentally brand a
 * column with a non-ID type.
 *
 * Includes every `<X>Id` brand declared above. Excludes compound/value brands
 * (`GroupMembershipKey`, `StorageKey`, `HexColor`, `SlugHash`,
 * `RecoveryKeyDisplay`, `ChecksumHex`) — those are not entity primary-key IDs.
 */
export type AnyBrandedId =
  | SystemId
  | MemberId
  | GroupId
  | BucketId
  | ChannelId
  | MessageId
  | NoteId
  | PollId
  | RelationshipId
  | SystemStructureEntityTypeId
  | SystemStructureEntityId
  | SystemStructureEntityLinkId
  | SystemStructureEntityMemberLinkId
  | SystemStructureEntityAssociationId
  | FieldDefinitionId
  | FieldDefinitionScopeId
  | FieldValueId
  | SessionId
  | LifecycleEventId
  | AccountId
  | BlobId
  | ApiKeyId
  | WebhookId
  | TimerId
  | JournalEntryId
  | WikiPageId
  | InnerWorldEntityId
  | InnerWorldRegionId
  | InnerWorldCanvasId
  | AuditLogEntryId
  | BoardMessageId
  | AcknowledgementId
  | CheckInRecordId
  | FriendConnectionId
  | KeyGrantId
  | FrontingSessionId
  | CustomFrontId
  | FriendCodeId
  | PollVoteId
  | DeviceTokenId
  | NotificationConfigId
  | SystemSettingsId
  | PollOptionId
  | MemberPhotoId
  | AuthKeyId
  | RecoveryKeyId
  | DeviceTransferRequestId
  | SyncDocumentId
  | SyncChangeId
  | SyncSnapshotId
  | ImportJobId
  | ImportEntityRefId
  | PKBridgeConfigId
  | AccountPurgeRequestId
  | ExportRequestId
  | JobId
  | SubscriptionId
  | WebhookDeliveryId
  | FrontingReportId
  | FriendNotificationPreferenceId
  | FrontingCommentId
  | BucketKeyRotationId
  | BucketRotationItemId
  | SystemSnapshotId
  | BiometricTokenId
  | SafeModeContentId;

// ── Branded value types (not entity IDs) ────────────────────────────

/** Human-readable recovery key display string (e.g. ABCD-EFGH-...). */
export type RecoveryKeyDisplay = Brand<string, "RecoveryKeyDisplay">;

/** Checksum hex digest (64 lowercase hex characters). */
export type ChecksumHex = Brand<string, "ChecksumHex">;
