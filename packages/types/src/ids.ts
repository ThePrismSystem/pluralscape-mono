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
export type EventId = Brand<string, "EventId">;
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
  event: "evt_",
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
} as const;

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
  | "field-definition"
  | "field-value"
  | "api-key"
  | "audit-log-entry"
  | "check-in-record"
  | "friend-connection"
  | "key-grant"
  | "device-token"
  | "poll-vote";
