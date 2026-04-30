/**
 * Member, structure, and lifecycle const arrays for varchar CHECK constraints.
 * Values sourced from @pluralscape/types union types.
 */

import {
  type BlobPurpose,
  type DiscoveryStatus,
  type EntityType,
  type ExportFormat,
  type ExportRequestStatus,
  type FieldDefinitionScopeType,
  type LifecycleEventType,
  type RelationshipType,
  type ReportFormat,
  type SearchableEntityType,
  type SnapshotTrigger,
} from "@pluralscape/types";

export { FIELD_TYPES } from "@pluralscape/types";
export { KNOWN_SATURATION_LEVELS } from "@pluralscape/types";

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

export const BLOB_PURPOSES = [
  "avatar",
  "member-photo",
  "journal-image",
  "attachment",
  "export",
  "littles-safe-mode",
] as const satisfies readonly BlobPurpose[];

export const EXPORT_FORMATS = ["json", "csv"] as const satisfies readonly ExportFormat[];

export const EXPORT_REQUEST_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const satisfies readonly ExportRequestStatus[];

export const FRONTING_REPORT_FORMATS = ["html", "pdf"] as const satisfies readonly ReportFormat[];

export const SNAPSHOT_TRIGGERS = [
  "manual",
  "scheduled-daily",
  "scheduled-weekly",
] as const satisfies readonly SnapshotTrigger[];

export const FIELD_DEFINITION_SCOPE_TYPES = [
  "system",
  "member",
  "group",
  "structure-entity-type",
] as const satisfies readonly FieldDefinitionScopeType[];

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
