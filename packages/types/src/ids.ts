/** @internal Implementation detail — do not construct branded IDs via this symbol; use `brandId()`. */
export declare const __brand: unique symbol;

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
  structureEntityType: "stet_",
  structureEntity: "ste_",
  structureEntityLink: "stel_",
  structureEntityMemberLink: "steml_",
  structureEntityAssociation: "stea_",
  fieldDefinition: "fld_",
  fieldDefinitionScope: "fds_",
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
  authKey: "auk_",
  recoveryKey: "rk_",
  deviceTransferRequest: "dtr_",
  syncDocument: "sdoc_",
  syncChange: "schg_",
  syncSnapshot: "ssnp_",
  importJob: "ij_",
  importEntityRef: "ier_",
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
  stet_: "SystemStructureEntityTypeId";
  ste_: "SystemStructureEntityId";
  stel_: "SystemStructureEntityLinkId";
  steml_: "SystemStructureEntityMemberLinkId";
  stea_: "SystemStructureEntityAssociationId";
  fld_: "FieldDefinitionId";
  fds_: "FieldDefinitionScopeId";
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
  auk_: "AuthKeyId";
  rk_: "RecoveryKeyId";
  dtr_: "DeviceTransferRequestId";
  sdoc_: "SyncDocumentId";
  schg_: "SyncChangeId";
  ssnp_: "SyncSnapshotId";
  ij_: "ImportJobId";
  ier_: "ImportEntityRefId";
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
}

// Helper: constrains T to Record<string, true> — fails at definition site if any value is not `true`.
type AssertAllTrue<T extends Record<string, true>> = T;

// Compile-time check: every ID_PREFIXES value must appear as a key in IdPrefixBrandMap.
// Adding a prefix to ID_PREFIXES without a matching entry in IdPrefixBrandMap is a type error.
export type AssertAllPrefixesMapped = AssertAllTrue<{
  [K in keyof typeof ID_PREFIXES as (typeof ID_PREFIXES)[K]]: (typeof ID_PREFIXES)[K] extends keyof IdPrefixBrandMap
    ? true
    : `Missing prefix mapping for "${(typeof ID_PREFIXES)[K]}"`;
}>;

// Compile-time check: every EntityType variant must appear as a key in EntityTypeIdMap.
// Adding an EntityType without a matching entry in EntityTypeIdMap is a type error.
export type AssertAllEntityTypesMapped = AssertAllTrue<{
  [K in EntityType]: K extends keyof EntityTypeIdMap
    ? true
    : `Missing EntityTypeIdMap entry for "${K}"`;
}>;

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
  | "structure-entity-type"
  | "structure-entity"
  | "structure-entity-link"
  | "structure-entity-member-link"
  | "structure-entity-association"
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
  | "biometric-token"
  | "field-definition-scope";

// ── EntityType → branded ID mapping ────────────────────────────────

/** Maps each {@link EntityType} variant to its branded ID type. */
export type EntityTypeIdMap = {
  system: SystemId;
  member: MemberId;
  group: GroupId;
  bucket: BucketId;
  channel: ChannelId;
  message: MessageId;
  note: NoteId;
  poll: PollId;
  relationship: RelationshipId;
  "structure-entity-type": SystemStructureEntityTypeId;
  "structure-entity": SystemStructureEntityId;
  "structure-entity-link": SystemStructureEntityLinkId;
  "structure-entity-member-link": SystemStructureEntityMemberLinkId;
  "structure-entity-association": SystemStructureEntityAssociationId;
  "journal-entry": JournalEntryId;
  "wiki-page": WikiPageId;
  "custom-front": CustomFrontId;
  "fronting-session": FrontingSessionId;
  blob: BlobId;
  webhook: WebhookId;
  timer: TimerId;
  "board-message": BoardMessageId;
  acknowledgement: AcknowledgementId;
  "innerworld-entity": InnerWorldEntityId;
  "innerworld-region": InnerWorldRegionId;
  "innerworld-canvas": InnerWorldCanvasId;
  "field-definition": FieldDefinitionId;
  "field-value": FieldValueId;
  "api-key": ApiKeyId;
  "audit-log-entry": AuditLogEntryId;
  "check-in-record": CheckInRecordId;
  "friend-connection": FriendConnectionId;
  "key-grant": KeyGrantId;
  "device-token": DeviceTokenId;
  "poll-vote": PollVoteId;
  session: SessionId;
  "lifecycle-event": LifecycleEventId;
  account: AccountId;
  "friend-code": FriendCodeId;
  "notification-config": NotificationConfigId;
  "system-settings": SystemSettingsId;
  "poll-option": PollOptionId;
  "member-photo": MemberPhotoId;
  "auth-key": AuthKeyId;
  "recovery-key": RecoveryKeyId;
  "device-transfer-request": DeviceTransferRequestId;
  "sync-document": SyncDocumentId;
  "sync-change": SyncChangeId;
  "sync-snapshot": SyncSnapshotId;
  "import-job": ImportJobId;
  "pk-bridge-config": PKBridgeConfigId;
  "account-purge-request": AccountPurgeRequestId;
  "export-request": ExportRequestId;
  job: JobId;
  "webhook-delivery": WebhookDeliveryId;
  "fronting-report": FrontingReportId;
  "friend-notification-preference": FriendNotificationPreferenceId;
  "fronting-comment": FrontingCommentId;
  "bucket-key-rotation": BucketKeyRotationId;
  "bucket-rotation-item": BucketRotationItemId;
  "system-snapshot": SystemSnapshotId;
  "biometric-token": BiometricTokenId;
  "field-definition-scope": FieldDefinitionScopeId;
};
