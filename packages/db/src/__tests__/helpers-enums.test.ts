import { describe, expect, it } from "vitest";

import {
  AUTH_KEY_TYPES,
  BUCKET_VISIBILITY_SCOPES,
  COMPLETENESS_LEVELS,
  DEVICE_TRANSFER_STATUSES,
  FRIEND_CONNECTION_STATUSES,
  FRONTING_TYPES,
  LAYER_ACCESS_TYPES,
  RELATIONSHIP_TYPES,
  SYNC_OPERATIONS,
  SYNC_RESOLUTIONS,
} from "../helpers/enums.js";

describe("enum arrays", () => {
  it("COMPLETENESS_LEVELS matches CompletenessLevel union", () => {
    expect(COMPLETENESS_LEVELS).toEqual(["fragment", "demi-member", "full"]);
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

  it("all arrays have correct element counts", () => {
    expect(COMPLETENESS_LEVELS).toHaveLength(3);
    expect(FRONTING_TYPES).toHaveLength(2);
    expect(RELATIONSHIP_TYPES).toHaveLength(10);
    expect(LAYER_ACCESS_TYPES).toHaveLength(2);
    expect(FRIEND_CONNECTION_STATUSES).toHaveLength(4);
    expect(BUCKET_VISIBILITY_SCOPES).toHaveLength(9);
    expect(AUTH_KEY_TYPES).toHaveLength(2);
    expect(DEVICE_TRANSFER_STATUSES).toHaveLength(3);
    expect(SYNC_OPERATIONS).toHaveLength(3);
    expect(SYNC_RESOLUTIONS).toHaveLength(3);
  });
});
