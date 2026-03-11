/**
 * Const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 * Used in both PG and SQLite table definitions.
 */

import type {
  AccountPurgeStatus,
  ApiKey,
  ApiKeyScope,
  AuditEventType,
  AuthKeyType,
  BlobPurpose,
  BucketVisibilityScope,
  DeviceTokenPlatform,
  DeviceTransferStatus,
  ExportFormat,
  ExportRequestStatus,
  FriendConnectionStatus,
  FrontingType,
  ImportJobStatus,
  ImportSource,
  JobStatus,
  JobType,
  KnownSaturationLevel,
  LayerAccessType,
  NotificationEventType,
  PKSyncDirection,
  PollKind,
  RelationshipType,
  SearchableEntityType,
  ServerChannel,
  ServerInnerWorldEntity,
  ServerInnerWorldRegion,
  ServerPoll,
  SyncOperation,
  SyncResolution,
  WebhookDeliveryStatus,
  WebhookEventType,
} from "@pluralscape/types";

export const KNOWN_SATURATION_LEVELS = [
  "fragment",
  "functional-fragment",
  "partially-elaborated",
  "highly-elaborated",
] as const satisfies readonly KnownSaturationLevel[];
export const FRONTING_TYPES = [
  "fronting",
  "co-conscious",
] as const satisfies readonly FrontingType[];
export const RELATIONSHIP_TYPES = [
  "split-from",
  "fused-from",
  "sibling",
  "partner",
  "parent-child",
  "protector-of",
  "caretaker-of",
  "gatekeeper-of",
  "source",
  "custom",
] as const satisfies readonly RelationshipType[];
export const LAYER_ACCESS_TYPES = [
  "open",
  "gatekept",
] as const satisfies readonly LayerAccessType[];
export const FRIEND_CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "blocked",
  "removed",
] as const satisfies readonly FriendConnectionStatus[];
export const BUCKET_VISIBILITY_SCOPES = [
  "members",
  "custom-fields",
  "fronting-status",
  "custom-fronts",
  "notes",
  "chat",
  "journal-entries",
  "member-photos",
  "groups",
] as const satisfies readonly BucketVisibilityScope[];
export const AUTH_KEY_TYPES = ["encryption", "signing"] as const satisfies readonly AuthKeyType[];
export const DEVICE_TRANSFER_STATUSES = [
  "pending",
  "approved",
  "expired",
] as const satisfies readonly DeviceTransferStatus[];
export const SYNC_OPERATIONS = [
  "create",
  "update",
  "delete",
] as const satisfies readonly SyncOperation[];
export const SYNC_RESOLUTIONS = [
  "local",
  "remote",
  "merged",
] as const satisfies readonly SyncResolution[];
/** Naming convention: TABLE_COLUMN (e.g. API_KEY_KEY_TYPES = api_keys.key_type). */
export const API_KEY_KEY_TYPES = [
  "metadata",
  "crypto",
] as const satisfies readonly ApiKey["keyType"][];
export const API_KEY_SCOPES = [
  "read:members",
  "write:members",
  "read:fronting",
  "write:fronting",
  "read:groups",
  "write:groups",
  "read:system",
  "write:system",
  "read:webhooks",
  "write:webhooks",
  "read:audit-log",
  "read:blobs",
  "write:blobs",
  "read:notifications",
  "write:notifications",
  "full",
] as const satisfies readonly ApiKeyScope[];
export const AUDIT_EVENT_TYPES = [
  "auth.login",
  "auth.login-failed",
  "auth.logout",
  "auth.password-changed",
  "auth.recovery-key-used",
  "auth.key-created",
  "auth.key-revoked",
  "data.export",
  "data.import",
  "data.purge",
  "settings.changed",
  "member.created",
  "member.archived",
  "sharing.granted",
  "sharing.revoked",
  "bucket.key_rotation.initiated",
  "bucket.key_rotation.chunk_completed",
  "bucket.key_rotation.completed",
  "bucket.key_rotation.failed",
  "device.security.jailbreak_warning_shown",
] as const satisfies readonly AuditEventType[];
export const CHANNEL_TYPES = [
  "category",
  "channel",
] as const satisfies readonly ServerChannel["type"][];
export const POLL_STATUSES = ["open", "closed"] as const satisfies readonly ServerPoll["status"][];
export const POLL_KINDS = ["standard", "custom"] as const satisfies readonly PollKind[];
export const INNERWORLD_ENTITY_TYPES = [
  "member",
  "landmark",
  "subsystem",
  "side-system",
  "layer",
] as const satisfies readonly ServerInnerWorldEntity["entityType"][];
export const INNERWORLD_REGION_ACCESS_TYPES = [
  "open",
  "gatekept",
] as const satisfies readonly ServerInnerWorldRegion["accessType"][];
export const PK_SYNC_DIRECTIONS = [
  "ps-to-pk",
  "pk-to-ps",
  "bidirectional",
] as const satisfies readonly PKSyncDirection[];
export const DEVICE_TOKEN_PLATFORMS = [
  "ios",
  "android",
  "web",
] as const satisfies readonly DeviceTokenPlatform[];
export const NOTIFICATION_EVENT_TYPES = [
  "switch-reminder",
  "check-in-due",
  "acknowledgement-requested",
  "message-received",
  "sync-conflict",
  "friend-switch-alert",
] as const satisfies readonly NotificationEventType[];
export const WEBHOOK_EVENT_TYPES = [
  "member.created",
  "member.updated",
  "member.archived",
  "fronting.started",
  "fronting.ended",
  "switch.recorded",
  "group.created",
  "group.updated",
  "note.created",
  "note.updated",
  "chat.message-sent",
  "poll.created",
  "poll.closed",
  "acknowledgement.requested",
  "lifecycle.event-recorded",
  "custom-front.changed",
] as const satisfies readonly WebhookEventType[];
export const WEBHOOK_DELIVERY_STATUSES = [
  "pending",
  "success",
  "failed",
] as const satisfies readonly WebhookDeliveryStatus[];
export const BLOB_PURPOSES = [
  "avatar",
  "member-photo",
  "journal-image",
  "attachment",
  "export",
  "littles-safe-mode",
] as const satisfies readonly BlobPurpose[];
export const IMPORT_SOURCES = [
  "simply-plural",
  "pluralkit",
  "pluralscape",
] as const satisfies readonly ImportSource[];
export const IMPORT_JOB_STATUSES = [
  "pending",
  "validating",
  "importing",
  "completed",
  "failed",
] as const satisfies readonly ImportJobStatus[];
export const EXPORT_FORMATS = ["json", "csv"] as const satisfies readonly ExportFormat[];
export const EXPORT_REQUEST_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const satisfies readonly ExportRequestStatus[];
export const ACCOUNT_PURGE_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "completed",
  "cancelled",
] as const satisfies readonly AccountPurgeStatus[];
export const SEARCHABLE_ENTITY_TYPES = [
  "member",
  "group",
  "journal-entry",
  "wiki-page",
  "channel",
  "note",
  "custom-field",
  "chat-message",
  "board-message",
] as const satisfies readonly SearchableEntityType[];
export const JOB_TYPES = [
  "sync-push",
  "sync-pull",
  "blob-upload",
  "blob-cleanup",
  "export-generate",
  "import-process",
  "webhook-deliver",
  "notification-send",
  "analytics-compute",
  "account-purge",
  "bucket-key-rotation",
  "report-generate",
] as const satisfies readonly JobType[];
export const JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const satisfies readonly JobStatus[];
