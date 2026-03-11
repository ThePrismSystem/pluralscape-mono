import { describe, expect, it } from "vitest";

import {
  ACCOUNT_PURGE_STATUSES,
  API_KEY_KEY_TYPES,
  API_KEY_SCOPES,
  AUDIT_EVENT_TYPES,
  AUTH_KEY_TYPES,
  BLOB_PURPOSES,
  BUCKET_VISIBILITY_SCOPES,
  CHANNEL_TYPES,
  DEVICE_TOKEN_PLATFORMS,
  DEVICE_TRANSFER_STATUSES,
  EXPORT_FORMATS,
  EXPORT_REQUEST_STATUSES,
  FRIEND_CONNECTION_STATUSES,
  FRONTING_TYPES,
  IMPORT_JOB_STATUSES,
  IMPORT_SOURCES,
  JOB_STATUSES,
  JOB_TYPES,
  KNOWN_SATURATION_LEVELS,
  LAYER_ACCESS_TYPES,
  NOTIFICATION_EVENT_TYPES,
  PK_SYNC_DIRECTIONS,
  POLL_KINDS,
  POLL_STATUSES,
  RELATIONSHIP_TYPES,
  SEARCHABLE_ENTITY_TYPES,
  SYNC_OPERATIONS,
  SYNC_RESOLUTIONS,
  WEBHOOK_DELIVERY_STATUSES,
  WEBHOOK_EVENT_TYPES,
} from "../helpers/enums.js";

describe("enum arrays", () => {
  it("KNOWN_SATURATION_LEVELS matches KnownSaturationLevel union", () => {
    expect(KNOWN_SATURATION_LEVELS).toEqual([
      "fragment",
      "functional-fragment",
      "partially-elaborated",
      "highly-elaborated",
    ]);
  });

  it("FRONTING_TYPES matches FrontingType union", () => {
    expect(FRONTING_TYPES).toEqual(["fronting", "co-conscious"]);
  });

  it("RELATIONSHIP_TYPES matches RelationshipType union", () => {
    expect(RELATIONSHIP_TYPES).toHaveLength(10);
    expect(RELATIONSHIP_TYPES).toContain("split-from");
    expect(RELATIONSHIP_TYPES).toContain("custom");
  });

  it("LAYER_ACCESS_TYPES matches LayerAccessType union", () => {
    expect(LAYER_ACCESS_TYPES).toEqual(["open", "gatekept"]);
  });

  it("FRIEND_CONNECTION_STATUSES matches FriendConnectionStatus union", () => {
    expect(FRIEND_CONNECTION_STATUSES).toEqual(["pending", "accepted", "blocked", "removed"]);
  });

  it("BUCKET_VISIBILITY_SCOPES matches BucketVisibilityScope union", () => {
    expect(BUCKET_VISIBILITY_SCOPES).toHaveLength(9);
    expect(BUCKET_VISIBILITY_SCOPES).toContain("members");
    expect(BUCKET_VISIBILITY_SCOPES).toContain("groups");
  });

  it("AUTH_KEY_TYPES matches AuthKeyType union", () => {
    expect(AUTH_KEY_TYPES).toEqual(["encryption", "signing"]);
  });

  it("DEVICE_TRANSFER_STATUSES matches DeviceTransferStatus union", () => {
    expect(DEVICE_TRANSFER_STATUSES).toEqual(["pending", "approved", "expired"]);
  });

  it("SYNC_OPERATIONS matches SyncOperation union", () => {
    expect(SYNC_OPERATIONS).toEqual(["create", "update", "delete"]);
  });

  it("SYNC_RESOLUTIONS matches SyncResolution union", () => {
    expect(SYNC_RESOLUTIONS).toEqual(["local", "remote", "merged"]);
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
    expect(AUDIT_EVENT_TYPES).toHaveLength(20);
    expect(AUDIT_EVENT_TYPES).toContain("auth.login");
    expect(AUDIT_EVENT_TYPES).toContain("device.security.jailbreak_warning_shown");
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
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(16);
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
    expect(JOB_TYPES).toHaveLength(12);
    expect(JOB_TYPES).toContain("sync-push");
    expect(JOB_TYPES).toContain("report-generate");
  });

  it("JOB_STATUSES matches JobStatus union", () => {
    expect(JOB_STATUSES).toEqual(["pending", "running", "completed", "failed", "cancelled"]);
  });

  it("all arrays have correct element counts", () => {
    expect(KNOWN_SATURATION_LEVELS).toHaveLength(4);
    expect(FRONTING_TYPES).toHaveLength(2);
    expect(RELATIONSHIP_TYPES).toHaveLength(10);
    expect(LAYER_ACCESS_TYPES).toHaveLength(2);
    expect(FRIEND_CONNECTION_STATUSES).toHaveLength(4);
    expect(BUCKET_VISIBILITY_SCOPES).toHaveLength(9);
    expect(AUTH_KEY_TYPES).toHaveLength(2);
    expect(DEVICE_TRANSFER_STATUSES).toHaveLength(3);
    expect(SYNC_OPERATIONS).toHaveLength(3);
    expect(SYNC_RESOLUTIONS).toHaveLength(3);
    expect(API_KEY_KEY_TYPES).toHaveLength(2);
    expect(API_KEY_SCOPES).toHaveLength(16);
    expect(AUDIT_EVENT_TYPES).toHaveLength(20);
    expect(CHANNEL_TYPES).toHaveLength(2);
    expect(POLL_STATUSES).toHaveLength(2);
    expect(POLL_KINDS).toHaveLength(2);
    expect(PK_SYNC_DIRECTIONS).toHaveLength(3);
    expect(DEVICE_TOKEN_PLATFORMS).toHaveLength(3);
    expect(NOTIFICATION_EVENT_TYPES).toHaveLength(6);
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(16);
    expect(WEBHOOK_DELIVERY_STATUSES).toHaveLength(3);
    expect(BLOB_PURPOSES).toHaveLength(6);
    expect(IMPORT_SOURCES).toHaveLength(3);
    expect(IMPORT_JOB_STATUSES).toHaveLength(5);
    expect(EXPORT_FORMATS).toHaveLength(2);
    expect(EXPORT_REQUEST_STATUSES).toHaveLength(4);
    expect(ACCOUNT_PURGE_STATUSES).toHaveLength(5);
    expect(SEARCHABLE_ENTITY_TYPES).toHaveLength(9);
    expect(JOB_TYPES).toHaveLength(12);
    expect(JOB_STATUSES).toHaveLength(5);
  });
});
