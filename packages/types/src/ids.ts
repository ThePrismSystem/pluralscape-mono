declare const __brand: unique symbol;

/**
 * Branded type — makes `T` nominally distinct via a phantom brand tag.
 * A `Brand<string, 'SystemId'>` is not assignable from a plain `string`
 * or from `Brand<string, 'MemberId'>`.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Branded ID types ────────────────────────────────────────────────

export type SystemId = Brand<string, "SystemId">;
export type MemberId = Brand<string, "MemberId">;
export type GroupId = Brand<string, "GroupId">;
export type BucketId = Brand<string, "BucketId">;
export type ChannelId = Brand<string, "ChannelId">;
export type MessageId = Brand<string, "MessageId">;
export type NoteId = Brand<string, "NoteId">;
export type PollId = Brand<string, "PollId">;
export type RelationshipId = Brand<string, "RelationshipId">;
export type SubsystemId = Brand<string, "SubsystemId">;
export type FieldDefinitionId = Brand<string, "FieldDefinitionId">;
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
export type SideSystemId = Brand<string, "SideSystemId">;
export type LayerId = Brand<string, "LayerId">;
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
export type SwitchId = Brand<string, "SwitchId">;
export type AuthKeyId = Brand<string, "AuthKeyId">;
export type RecoveryKeyId = Brand<string, "RecoveryKeyId">;
export type DeviceTransferRequestId = Brand<string, "DeviceTransferRequestId">;
export type SyncDocumentId = Brand<string, "SyncDocumentId">;
export type SyncChangeId = Brand<string, "SyncChangeId">;
export type SyncSnapshotId = Brand<string, "SyncSnapshotId">;
export type ImportJobId = Brand<string, "ImportJobId">;
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
export type SubsystemMembershipId = Brand<string, "SubsystemMembershipId">;
export type SideSystemMembershipId = Brand<string, "SideSystemMembershipId">;
export type LayerMembershipId = Brand<string, "LayerMembershipId">;
export type StructureLinkId = Brand<string, "StructureLinkId">;
export type StorageKey = Brand<string, "StorageKey">;
export type HexColor = Brand<string, "HexColor">;
export type SlugHash = Brand<string, "SlugHash">;

// ── Branded value types (not entity IDs) ────────────────────────────

/** Human-readable recovery key display string (e.g. ABCD-EFGH-...). */
export type RecoveryKeyDisplay = Brand<string, "RecoveryKeyDisplay">;

/** Checksum hex digest (64 lowercase hex characters). */
export type ChecksumHex = Brand<string, "ChecksumHex">;

// ── ID prefix convention ────────────────────────────────────────────

export const ID_PREFIXES = {
  system: "sys_",
  member: "mem_",
  group: "grp_",
  bucket: "bkt_",
  channel: "ch_",
  message: "msg_",
  note: "note_",
  poll: "poll_",
  relationship: "rel_",
  subsystem: "sub_",
  fieldDefinition: "fld_",
  fieldValue: "fv_",
  session: "sess_",
  lifecycleEvent: "evt_",
  account: "acct_",
  blob: "blob_",
  apiKey: "ak_",
  webhook: "wh_",
  timer: "tmr_",
  journalEntry: "je_",
  wikiPage: "wp_",
  sideSystem: "ss_",
  layer: "lyr_",
  innerWorldEntity: "iwe_",
  innerWorldRegion: "iwr_",
  innerWorldCanvas: "iwc_",
  auditLogEntry: "al_",
  boardMessage: "bm_",
  acknowledgement: "ack_",
  checkInRecord: "cir_",
  friendConnection: "fc_",
  keyGrant: "kg_",
  frontingSession: "fs_",
  customFront: "cf_",
  friendCode: "frc_",
  pollVote: "pv_",
  deviceToken: "dt_",
  notificationConfig: "nc_",
  systemSettings: "sset_",
  pollOption: "po_",
  memberPhoto: "mp_",
  switch: "sw_",
  authKey: "auk_",
  recoveryKey: "rk_",
  deviceTransferRequest: "dtr_",
  syncDocument: "sdoc_",
  syncChange: "schg_",
  syncSnapshot: "ssnp_",
  importJob: "ij_",
  pkBridgeConfig: "pkb_",
  accountPurgeRequest: "apr_",
  exportRequest: "er_",
  job: "job_",
  webhookDelivery: "wd_",
  frontingReport: "fr_",
  friendNotificationPreference: "fnp_",
  frontingComment: "fcom_",
  bucketKeyRotation: "bkr_",
  bucketRotationItem: "bri_",
  systemSnapshot: "snap_",
  biometricToken: "bt_",
  subsystemMembership: "subm_",
  sideSystemMembership: "ssm_",
  layerMembership: "lyrm_",
  structureLink: "slink_",
} as const;

/** Maps each ID prefix value to its Brand tag string. */
export interface IdPrefixBrandMap {
  sys_: "SystemId";
  mem_: "MemberId";
  grp_: "GroupId";
  bkt_: "BucketId";
  ch_: "ChannelId";
  msg_: "MessageId";
  note_: "NoteId";
  poll_: "PollId";
  rel_: "RelationshipId";
  sub_: "SubsystemId";
  fld_: "FieldDefinitionId";
  fv_: "FieldValueId";
  sess_: "SessionId";
  evt_: "LifecycleEventId";
  acct_: "AccountId";
  blob_: "BlobId";
  ak_: "ApiKeyId";
  wh_: "WebhookId";
  tmr_: "TimerId";
  je_: "JournalEntryId";
  wp_: "WikiPageId";
  ss_: "SideSystemId";
  lyr_: "LayerId";
  iwe_: "InnerWorldEntityId";
  iwr_: "InnerWorldRegionId";
  iwc_: "InnerWorldCanvasId";
  al_: "AuditLogEntryId";
  bm_: "BoardMessageId";
  ack_: "AcknowledgementId";
  cir_: "CheckInRecordId";
  fc_: "FriendConnectionId";
  kg_: "KeyGrantId";
  fs_: "FrontingSessionId";
  cf_: "CustomFrontId";
  frc_: "FriendCodeId";
  pv_: "PollVoteId";
  dt_: "DeviceTokenId";
  nc_: "NotificationConfigId";
  sset_: "SystemSettingsId";
  po_: "PollOptionId";
  mp_: "MemberPhotoId";
  sw_: "SwitchId";
  auk_: "AuthKeyId";
  rk_: "RecoveryKeyId";
  dtr_: "DeviceTransferRequestId";
  sdoc_: "SyncDocumentId";
  schg_: "SyncChangeId";
  ssnp_: "SyncSnapshotId";
  ij_: "ImportJobId";
  pkb_: "PKBridgeConfigId";
  apr_: "AccountPurgeRequestId";
  er_: "ExportRequestId";
  job_: "JobId";
  wd_: "WebhookDeliveryId";
  fr_: "FrontingReportId";
  fnp_: "FriendNotificationPreferenceId";
  fcom_: "FrontingCommentId";
  bkr_: "BucketKeyRotationId";
  bri_: "BucketRotationItemId";
  snap_: "SystemSnapshotId";
  bt_: "BiometricTokenId";
  subm_: "SubsystemMembershipId";
  ssm_: "SideSystemMembershipId";
  lyrm_: "LayerMembershipId";
  slink_: "StructureLinkId";
}

// ── EntityType union ────────────────────────────────────────────────

export type EntityType =
  | "system"
  | "member"
  | "group"
  | "bucket"
  | "channel"
  | "message"
  | "note"
  | "poll"
  | "relationship"
  | "subsystem"
  | "side-system"
  | "layer"
  | "journal-entry"
  | "wiki-page"
  | "custom-front"
  | "fronting-session"
  | "blob"
  | "webhook"
  | "timer"
  | "board-message"
  | "acknowledgement"
  | "innerworld-entity"
  | "innerworld-region"
  | "innerworld-canvas"
  | "field-definition"
  | "field-value"
  | "api-key"
  | "audit-log-entry"
  | "check-in-record"
  | "friend-connection"
  | "key-grant"
  | "device-token"
  | "poll-vote"
  | "session"
  | "lifecycle-event"
  | "account"
  | "friend-code"
  | "notification-config"
  | "system-settings"
  | "poll-option"
  | "member-photo"
  | "switch"
  | "auth-key"
  | "recovery-key"
  | "device-transfer-request"
  | "sync-document"
  | "sync-change"
  | "sync-snapshot"
  | "import-job"
  | "pk-bridge-config"
  | "account-purge-request"
  | "export-request"
  | "job"
  | "webhook-delivery"
  | "fronting-report"
  | "friend-notification-preference"
  | "fronting-comment"
  | "bucket-key-rotation"
  | "bucket-rotation-item"
  | "system-snapshot"
  | "biometric-token";
