import { describe, expect, it } from "vitest";

import { enumCheck } from "../helpers/check.js";
import {
  parseBucketContentEntityType,
  ACCOUNT_TYPES,
  ACCOUNT_PURGE_STATUSES,
  API_KEY_KEY_TYPES,
  API_KEY_SCOPES,
  AUDIT_EVENT_TYPES,
  AUTH_KEY_TYPES,
  BLOB_PURPOSES,
  CHANNEL_TYPES,
  DEVICE_TOKEN_PLATFORMS,
  DEVICE_TRANSFER_STATUSES,
  DISCOVERY_STATUSES,
  BUCKET_CONTENT_ENTITY_TYPES,
  ENTITY_TYPES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  FRIEND_CONNECTION_STATUSES,
  FRONTING_REPORT_FORMATS,
  IMPORT_JOB_STATUSES,
  IMPORT_SOURCES,
  JOB_STATUSES,
  JOB_TYPES,
  KNOWN_SATURATION_LEVELS,
  FIELD_DEFINITION_SCOPE_TYPES,
  LIFECYCLE_EVENT_TYPES,
  NOTIFICATION_EVENT_TYPES,
  PK_SYNC_DIRECTIONS,
  POLL_KINDS,
  POLL_STATUSES,
  RELATIONSHIP_TYPES,
  ROTATION_ITEM_STATUSES,
  ROTATION_STATES,
  SEARCHABLE_ENTITY_TYPES,
  SNAPSHOT_TRIGGERS,
  SYNC_DOC_TYPES,
  SYNC_KEY_TYPES,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_EVENT_TYPES,
} from "../helpers/enums.js";

import type { AnyColumn } from "drizzle-orm";

describe("enumCheck", () => {
  it("throws when called with an empty values array", () => {
    const fakeColumn = {} as AnyColumn;
    expect(() => enumCheck(fakeColumn, [])).toThrow("at least one value");
  });
});

describe("enum arrays", () => {
  it("KNOWN_SATURATION_LEVELS matches KnownSaturationLevel union", () => {
    expect(KNOWN_SATURATION_LEVELS).toEqual([
      "fragment",
      "functional-fragment",
      "partially-elaborated",
      "highly-elaborated",
    ]);
  });

  it("RELATIONSHIP_TYPES matches RelationshipType union", () => {
    expect(RELATIONSHIP_TYPES).toHaveLength(10);
    expect(RELATIONSHIP_TYPES).toContain("split-from");
    expect(RELATIONSHIP_TYPES).toContain("custom");
  });

  it("FIELD_DEFINITION_SCOPE_TYPES matches FieldDefinitionScopeType union", () => {
    expect(FIELD_DEFINITION_SCOPE_TYPES).toEqual([
      "system",
      "member",
      "group",
      "structure-entity-type",
    ]);
  });

  it("FRIEND_CONNECTION_STATUSES matches FriendConnectionStatus union", () => {
    expect(FRIEND_CONNECTION_STATUSES).toEqual(["pending", "accepted", "blocked", "removed"]);
  });

  it("AUTH_KEY_TYPES matches AuthKeyType union", () => {
    expect(AUTH_KEY_TYPES).toEqual(["encryption", "signing"]);
  });

  it("DEVICE_TRANSFER_STATUSES matches DeviceTransferStatus union", () => {
    expect(DEVICE_TRANSFER_STATUSES).toEqual(["pending", "approved", "expired"]);
  });

  it("SYNC_DOC_TYPES matches SyncDocumentType union", () => {
    expect(SYNC_DOC_TYPES).toEqual([
      "system-core",
      "fronting",
      "chat",
      "journal",
      "privacy-config",
      "bucket",
    ]);
  });

  it("SYNC_KEY_TYPES matches DocumentKeyType union", () => {
    expect(SYNC_KEY_TYPES).toEqual(["derived", "bucket"]);
  });

  it("API_KEY_KEY_TYPES matches ApiKey keyType union", () => {
    expect(API_KEY_KEY_TYPES).toEqual(["metadata", "crypto"]);
  });

  it("API_KEY_SCOPES matches ApiKeyScope union", () => {
    expect(API_KEY_SCOPES).toHaveLength(16);
    expect(API_KEY_SCOPES).toContain("read:members");
    expect(API_KEY_SCOPES).toContain("full");
  });

  it("AUDIT_EVENT_TYPES matches AuditEventType union", () => {
    expect(AUDIT_EVENT_TYPES).toHaveLength(119);
    expect(AUDIT_EVENT_TYPES).toContain("auth.login");
    expect(AUDIT_EVENT_TYPES).toContain("device.security.jailbreak_warning_shown");
    expect(AUDIT_EVENT_TYPES).toContain("auth.password-reset-via-recovery");
    expect(AUDIT_EVENT_TYPES).toContain("auth.recovery-key-regenerated");
    expect(AUDIT_EVENT_TYPES).toContain("auth.device-transfer-initiated");
    expect(AUDIT_EVENT_TYPES).toContain("auth.device-transfer-completed");
  });

  it("CHANNEL_TYPES matches ServerChannel type union", () => {
    expect(CHANNEL_TYPES).toEqual(["category", "channel"]);
  });

  it("POLL_STATUSES matches ServerPoll status union", () => {
    expect(POLL_STATUSES).toEqual(["open", "closed"]);
  });

  it("POLL_KINDS matches PollKind union", () => {
    expect(POLL_KINDS).toEqual(["standard", "custom"]);
  });

  it("PK_SYNC_DIRECTIONS matches PKSyncDirection union", () => {
    expect(PK_SYNC_DIRECTIONS).toEqual(["ps-to-pk", "pk-to-ps", "bidirectional"]);
  });

  it("DEVICE_TOKEN_PLATFORMS matches DeviceTokenPlatform union", () => {
    expect(DEVICE_TOKEN_PLATFORMS).toEqual(["ios", "android", "web"]);
  });

  it("NOTIFICATION_EVENT_TYPES matches NotificationEventType union", () => {
    expect(NOTIFICATION_EVENT_TYPES).toHaveLength(6);
    expect(NOTIFICATION_EVENT_TYPES).toContain("switch-reminder");
    expect(NOTIFICATION_EVENT_TYPES).toContain("friend-switch-alert");
  });

  it("WEBHOOK_EVENT_TYPES matches WebhookEventType union", () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(15);
    expect(WEBHOOK_EVENT_TYPES).toContain("member.created");
    expect(WEBHOOK_EVENT_TYPES).toContain("custom-front.changed");
  });

  it("WEBHOOK_DELIVERY_STATUSES matches WebhookDeliveryStatus union", () => {
    expect(WEBHOOK_DELIVERY_STATUSES).toEqual(["pending", "success", "failed"]);
  });

  it("BLOB_PURPOSES matches BlobPurpose union", () => {
    expect(BLOB_PURPOSES).toHaveLength(6);
    expect(BLOB_PURPOSES).toContain("avatar");
    expect(BLOB_PURPOSES).toContain("littles-safe-mode");
  });

  it("IMPORT_SOURCES matches ImportSource union", () => {
    expect(IMPORT_SOURCES).toEqual(["simply-plural", "pluralkit", "pluralscape"]);
  });

  it("IMPORT_JOB_STATUSES matches ImportJobStatus union", () => {
    expect(IMPORT_JOB_STATUSES).toEqual([
      "pending",
      "validating",
      "importing",
      "completed",
      "failed",
    ]);
  });

  it("EXPORT_FORMATS matches ExportFormat union", () => {
    expect(EXPORT_FORMATS).toEqual(["json", "csv"]);
  });

  it("EXPORT_REQUEST_STATUSES matches ExportRequestStatus union", () => {
    expect(EXPORT_REQUEST_STATUSES).toEqual(["pending", "processing", "completed", "failed"]);
  });

  it("ACCOUNT_PURGE_STATUSES matches AccountPurgeStatus union", () => {
    expect(ACCOUNT_PURGE_STATUSES).toEqual([
      "pending",
      "confirmed",
      "processing",
      "completed",
      "cancelled",
    ]);
  });

  it("SEARCHABLE_ENTITY_TYPES matches SearchableEntityType union", () => {
    expect(SEARCHABLE_ENTITY_TYPES).toHaveLength(9);
    expect(SEARCHABLE_ENTITY_TYPES).toContain("member");
    expect(SEARCHABLE_ENTITY_TYPES).toContain("board-message");
  });

  it("JOB_TYPES matches JobType union", () => {
    expect(JOB_TYPES).toHaveLength(15);
    expect(JOB_TYPES).toContain("sync-push");
    expect(JOB_TYPES).toContain("report-generate");
    expect(JOB_TYPES).toContain("partition-maintenance");
  });

  it("JOB_STATUSES matches JobStatus union", () => {
    expect(JOB_STATUSES).toEqual(["pending", "running", "completed", "cancelled", "dead-letter"]);
  });

  it("ENTITY_TYPES matches EntityType union", () => {
    expect(ENTITY_TYPES).toHaveLength(63);
    expect(ENTITY_TYPES).toContain("member");
    expect(ENTITY_TYPES).toContain("system");
    expect(ENTITY_TYPES).toContain("fronting-report");
    expect(ENTITY_TYPES).toContain("bucket-rotation-item");
    expect(ENTITY_TYPES).toContain("structure-entity-type");
    expect(ENTITY_TYPES).toContain("structure-entity");
    expect(ENTITY_TYPES).toContain("field-definition-scope");
  });

  it("FRONTING_REPORT_FORMATS matches ReportFormat union", () => {
    expect(FRONTING_REPORT_FORMATS).toEqual(["html", "pdf"]);
  });

  it("BUCKET_CONTENT_ENTITY_TYPES is a subset of ENTITY_TYPES", () => {
    for (const t of BUCKET_CONTENT_ENTITY_TYPES) {
      expect(ENTITY_TYPES).toContain(t);
    }
  });

  it("BUCKET_CONTENT_ENTITY_TYPES excludes infrastructure types", () => {
    const set = new Set<string>(BUCKET_CONTENT_ENTITY_TYPES);
    expect(set.has("session")).toBe(false);
    expect(set.has("job")).toBe(false);
    expect(set.has("auth-key")).toBe(false);
    expect(set.has("recovery-key")).toBe(false);
    expect(set.has("api-key")).toBe(false);
    expect(set.has("account")).toBe(false);
  });

  it("DISCOVERY_STATUSES matches DiscoveryStatus union", () => {
    expect(DISCOVERY_STATUSES).toEqual(["fully-mapped", "partially-mapped", "unknown"]);
  });

  it("ROTATION_STATES matches RotationState union", () => {
    expect(ROTATION_STATES).toHaveLength(5);
    expect(ROTATION_STATES).toContain("initiated");
    expect(ROTATION_STATES).toContain("failed");
  });

  it("ROTATION_ITEM_STATUSES matches RotationItemStatus union", () => {
    expect(ROTATION_ITEM_STATUSES).toHaveLength(4);
    expect(ROTATION_ITEM_STATUSES).toContain("pending");
    expect(ROTATION_ITEM_STATUSES).toContain("failed");
  });

  it("LIFECYCLE_EVENT_TYPES matches LifecycleEventType union", () => {
    expect(LIFECYCLE_EVENT_TYPES).toHaveLength(13);
    expect(LIFECYCLE_EVENT_TYPES).toContain("split");
    expect(LIFECYCLE_EVENT_TYPES).toContain("fusion");
    expect(LIFECYCLE_EVENT_TYPES).toContain("structure-move");
    expect(LIFECYCLE_EVENT_TYPES).toContain("innerworld-move");
  });

  it("SNAPSHOT_TRIGGERS matches SnapshotTrigger union", () => {
    expect(SNAPSHOT_TRIGGERS).toHaveLength(3);
    expect(SNAPSHOT_TRIGGERS).toContain("manual");
    expect(SNAPSHOT_TRIGGERS).toContain("scheduled-daily");
    expect(SNAPSHOT_TRIGGERS).toContain("scheduled-weekly");
  });

  it("all arrays have correct element counts", () => {
    expect(KNOWN_SATURATION_LEVELS).toHaveLength(4);
    expect(RELATIONSHIP_TYPES).toHaveLength(10);
    expect(FIELD_DEFINITION_SCOPE_TYPES).toHaveLength(4);
    expect(FRIEND_CONNECTION_STATUSES).toHaveLength(4);
    expect(AUTH_KEY_TYPES).toHaveLength(2);
    expect(DEVICE_TRANSFER_STATUSES).toHaveLength(3);
    expect(SYNC_DOC_TYPES).toHaveLength(6);
    expect(SYNC_KEY_TYPES).toHaveLength(2);
    expect(API_KEY_KEY_TYPES).toHaveLength(2);
    expect(API_KEY_SCOPES).toHaveLength(16);
    expect(AUDIT_EVENT_TYPES).toHaveLength(119);
    expect(CHANNEL_TYPES).toHaveLength(2);
    expect(POLL_STATUSES).toHaveLength(2);
    expect(POLL_KINDS).toHaveLength(2);
    expect(PK_SYNC_DIRECTIONS).toHaveLength(3);
    expect(DEVICE_TOKEN_PLATFORMS).toHaveLength(3);
    expect(NOTIFICATION_EVENT_TYPES).toHaveLength(6);
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(15);
    expect(WEBHOOK_DELIVERY_STATUSES).toHaveLength(3);
    expect(BLOB_PURPOSES).toHaveLength(6);
    expect(IMPORT_SOURCES).toHaveLength(3);
    expect(IMPORT_JOB_STATUSES).toHaveLength(5);
    expect(EXPORT_FORMATS).toHaveLength(2);
    expect(EXPORT_REQUEST_STATUSES).toHaveLength(4);
    expect(ACCOUNT_PURGE_STATUSES).toHaveLength(5);
    expect(SEARCHABLE_ENTITY_TYPES).toHaveLength(9);
    expect(JOB_TYPES).toHaveLength(15);
    expect(JOB_STATUSES).toHaveLength(5);
    expect(ENTITY_TYPES).toHaveLength(63);
    expect(FRONTING_REPORT_FORMATS).toHaveLength(2);
    expect(DISCOVERY_STATUSES).toHaveLength(3);
    expect(ROTATION_STATES).toHaveLength(5);
    expect(ROTATION_ITEM_STATUSES).toHaveLength(4);
    expect(ACCOUNT_TYPES).toHaveLength(2);
    expect(SNAPSHOT_TRIGGERS).toHaveLength(3);
    expect(LIFECYCLE_EVENT_TYPES).toHaveLength(13);
  });
});

describe("parseBucketContentEntityType", () => {
  it("returns valid BucketContentEntityType for known value", () => {
    expect(parseBucketContentEntityType("member")).toBe("member");
    expect(parseBucketContentEntityType("group")).toBe("group");
    expect(parseBucketContentEntityType("fronting-session")).toBe("fronting-session");
  });

  it("throws for non-string input", () => {
    expect(() => parseBucketContentEntityType(null)).toThrow("Expected entity_type string");
    expect(() => parseBucketContentEntityType(42)).toThrow("Expected entity_type string");
  });

  it("throws for unknown string", () => {
    expect(() => parseBucketContentEntityType("session")).toThrow(
      "Unknown BucketContentEntityType",
    );
    expect(() => parseBucketContentEntityType("nonexistent")).toThrow(
      "Unknown BucketContentEntityType",
    );
  });
});
