/**
 * Const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 * Used in both PG and SQLite table definitions.
 */

import type {
  AccountPurgeStatus,
  AccountType,
  ApiKey,
  ApiKeyScope,
  AuditEventType,
  AuthKeyType,
  BlobPurpose,
  BucketContentEntityType,
  DeviceTokenPlatform,
  DeviceTransferStatus,
  DiscoveryStatus,
  EntityType,
  ExportFormat,
  ExportRequestStatus,
  FieldDefinitionScopeType,
  FriendConnectionStatus,
  ImportJobStatus,
  ImportSource,
  JobStatus,
  JobType,
  KnownSaturationLevel,
  LifecycleEventType,
  NotificationEventType,
  PKSyncDirection,
  PollKind,
  RelationshipType,
  ReportFormat,
  RotationItemStatus,
  RotationState,
  SearchableEntityType,
  ServerChannel,
  ServerPoll,
  SnapshotTrigger,
  SyncDocumentType,
  DocumentKeyType,
  WebhookDeliveryStatus,
  WebhookEventType,
} from "@pluralscape/types";

export const ACCOUNT_TYPES = ["system", "viewer"] as const satisfies readonly AccountType[];
export const KNOWN_SATURATION_LEVELS = [
  "fragment",
  "functional-fragment",
  "partially-elaborated",
  "highly-elaborated",
] as const satisfies readonly KnownSaturationLevel[];
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
export const DISCOVERY_STATUSES = [
  "fully-mapped",
  "partially-mapped",
  "unknown",
] as const satisfies readonly DiscoveryStatus[];
export { FIELD_TYPES } from "@pluralscape/types";
export const LIFECYCLE_EVENT_TYPES = [
  "split",
  "fusion",
  "merge",
  "unmerge",
  "dormancy-start",
  "dormancy-end",
  "discovery",
  "archival",
  "structure-entity-formation",
  "form-change",
  "name-change",
  "structure-move",
  "innerworld-move",
] as const satisfies readonly LifecycleEventType[];
export const ROTATION_STATES = [
  "initiated",
  "migrating",
  "sealing",
  "completed",
  "failed",
] as const satisfies readonly RotationState[];
export const ROTATION_ITEM_STATUSES = [
  "pending",
  "claimed",
  "completed",
  "failed",
] as const satisfies readonly RotationItemStatus[];
export const FRIEND_CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "blocked",
  "removed",
] as const satisfies readonly FriendConnectionStatus[];
export const AUTH_KEY_TYPES = ["encryption", "signing"] as const satisfies readonly AuthKeyType[];
export const DEVICE_TRANSFER_STATUSES = [
  "pending",
  "approved",
  "expired",
] as const satisfies readonly DeviceTransferStatus[];
export const SYNC_DOC_TYPES = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "privacy-config",
  "bucket",
] as const satisfies readonly SyncDocumentType[];
export const SYNC_KEY_TYPES = ["derived", "bucket"] as const satisfies readonly DocumentKeyType[];
/**
 * Naming convention: TABLE_COLUMN (e.g. API_KEY_KEY_TYPES = api_keys.key_type).
 * Each array name maps to the table and column it constrains, so
 * `API_KEY_KEY_TYPES` → `api_keys.key_type`, `API_KEY_SCOPES` → `api_keys.scopes`, etc.
 */
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
  "auth.register",
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
  "member.deleted",
  "sharing.granted",
  "sharing.revoked",
  "bucket.key_rotation.initiated",
  "bucket.key_rotation.chunk_completed",
  "bucket.key_rotation.completed",
  "bucket.key_rotation.failed",
  "device.security.jailbreak_warning_shown",
  "auth.password-reset-via-recovery",
  "auth.recovery-key-regenerated",
  "auth.device-transfer-initiated",
  "auth.device-transfer-completed",
  "auth.email-changed",
  "system.created",
  "system.profile-updated",
  "system.deleted",
  "group.created",
  "group.updated",
  "group.archived",
  "group.restored",
  "group.moved",
  "group-membership.added",
  "group-membership.removed",
  "custom-front.created",
  "custom-front.updated",
  "custom-front.archived",
  "custom-front.restored",
  "group.deleted",
  "custom-front.deleted",
  "auth.biometric-enrolled",
  "auth.biometric-verified",
  "settings.pin-set",
  "settings.pin-removed",
  "settings.pin-verified",
  "settings.nomenclature-updated",
  "setup.step-completed",
  "setup.completed",
  "member.updated",
  "member.duplicated",
  "member.restored",
  "member-photo.created",
  "member-photo.archived",
  "member-photo.restored",
  "member-photo.reordered",
  "field-definition.created",
  "field-definition.updated",
  "field-definition.archived",
  "field-definition.restored",
  "field-value.set",
  "field-value.updated",
  "field-value.deleted",
  "structure-entity-type.created",
  "structure-entity-type.updated",
  "structure-entity-type.archived",
  "structure-entity-type.restored",
  "structure-entity-type.deleted",
  "structure-entity.created",
  "structure-entity.updated",
  "structure-entity.archived",
  "structure-entity.restored",
  "structure-entity.deleted",
  "structure-entity-link.created",
  "structure-entity-link.deleted",
  "structure-entity-member-link.added",
  "structure-entity-member-link.removed",
  "structure-entity-association.created",
  "structure-entity-association.deleted",
  "relationship.created",
  "relationship.updated",
  "relationship.archived",
  "relationship.restored",
  "relationship.deleted",
  "lifecycle-event.created",
  "lifecycle-event.archived",
  "lifecycle-event.restored",
  "lifecycle-event.deleted",
  "innerworld-region.created",
  "innerworld-region.updated",
  "innerworld-region.archived",
  "innerworld-region.restored",
  "innerworld-region.deleted",
  "innerworld-entity.created",
  "innerworld-entity.updated",
  "innerworld-entity.archived",
  "innerworld-entity.restored",
  "innerworld-entity.deleted",
  "innerworld-canvas.created",
  "innerworld-canvas.updated",
  "blob.upload-requested",
  "blob.confirmed",
  "blob.archived",
  "fronting-report.created",
  "fronting-report.deleted",
] as const satisfies readonly AuditEventType[];
export const CHANNEL_TYPES = [
  "category",
  "channel",
] as const satisfies readonly ServerChannel["type"][];
export const POLL_STATUSES = ["open", "closed"] as const satisfies readonly ServerPoll["status"][];
export const POLL_KINDS = ["standard", "custom"] as const satisfies readonly PollKind[];
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

/** Runtime validation for SearchableEntityType — rejects unknown strings at the trust boundary. */
export function parseSearchableEntityType(value: unknown): SearchableEntityType {
  if (typeof value !== "string") {
    throw new Error(`Expected entity_type string, got ${typeof value}`);
  }
  const types: readonly string[] = SEARCHABLE_ENTITY_TYPES;
  if (!types.includes(value)) {
    throw new Error(`Unknown SearchableEntityType: ${value}`);
  }
  return value as SearchableEntityType;
}
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
  "audit-log-cleanup",
  "partition-maintenance",
  "device-transfer-cleanup",
] as const satisfies readonly JobType[];
export const JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "cancelled",
  "dead-letter",
] as const satisfies readonly JobStatus[];
export const ENTITY_TYPES = [
  "system",
  "member",
  "group",
  "bucket",
  "channel",
  "message",
  "note",
  "poll",
  "relationship",
  "structure-entity-type",
  "structure-entity",
  "structure-entity-link",
  "structure-entity-member-link",
  "structure-entity-association",
  "journal-entry",
  "wiki-page",
  "custom-front",
  "fronting-session",
  "blob",
  "webhook",
  "timer",
  "board-message",
  "acknowledgement",
  "innerworld-entity",
  "innerworld-region",
  "innerworld-canvas",
  "field-definition",
  "field-value",
  "api-key",
  "audit-log-entry",
  "check-in-record",
  "friend-connection",
  "key-grant",
  "device-token",
  "poll-vote",
  "session",
  "lifecycle-event",
  "account",
  "friend-code",
  "notification-config",
  "system-settings",
  "poll-option",
  "member-photo",
  "auth-key",
  "recovery-key",
  "device-transfer-request",
  "sync-document",
  "sync-change",
  "sync-snapshot",
  "import-job",
  "pk-bridge-config",
  "account-purge-request",
  "export-request",
  "job",
  "webhook-delivery",
  "fronting-report",
  "friend-notification-preference",
  "fronting-comment",
  "bucket-key-rotation",
  "bucket-rotation-item",
  "system-snapshot",
  "biometric-token",
  "field-definition-scope",
] as const satisfies readonly EntityType[];
export const FRONTING_REPORT_FORMATS = ["html", "pdf"] as const satisfies readonly ReportFormat[];
export const SNAPSHOT_TRIGGERS = [
  "manual",
  "scheduled-daily",
  "scheduled-weekly",
] as const satisfies readonly SnapshotTrigger[];

/**
 * Entity types that can be tagged in privacy buckets — user-owned content
 * subject to bucket-level privacy controls (shareable via friend connections).
 * Infrastructure types (accounts, sessions, jobs, sync documents, etc.) are
 * excluded because they are internal to the system and never shared.
 */
export const BUCKET_CONTENT_ENTITY_TYPES = [
  "member",
  "group",
  "channel",
  "message",
  "note",
  "poll",
  "relationship",
  "structure-entity-type",
  "structure-entity",
  "journal-entry",
  "wiki-page",
  "custom-front",
  "fronting-session",
  "board-message",
  "acknowledgement",
  "innerworld-entity",
  "innerworld-region",
  "field-definition",
  "field-value",
  "member-photo",
  "fronting-comment",
] as const satisfies readonly BucketContentEntityType[];

export const FIELD_DEFINITION_SCOPE_TYPES = [
  "system",
  "member",
  "group",
  "structure-entity-type",
] as const satisfies readonly FieldDefinitionScopeType[];

/** Runtime validation for BucketContentEntityType — rejects unknown strings at the trust boundary. */
export function parseBucketContentEntityType(value: unknown): BucketContentEntityType {
  if (typeof value !== "string") {
    throw new Error(`Expected entity_type string, got ${typeof value}`);
  }
  const types: readonly string[] = BUCKET_CONTENT_ENTITY_TYPES;
  if (!types.includes(value)) {
    throw new Error(`Unknown BucketContentEntityType: ${value}`);
  }
  return value as BucketContentEntityType;
}
