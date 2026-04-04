import { describe, expect, it } from "vitest";

import { narrowFriendConnection, narrowFriendConnectionPage } from "../friend-connection.js";

import type { FriendConnectionRaw } from "../friend-connection.js";
import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  FriendConnectionStatus,
  FriendVisibilitySettings,
  UnixMillis,
} from "@pluralscape/types";

const NOW = 1_700_000_000_000 as UnixMillis;
const LATER = 1_700_002_000_000 as UnixMillis;

const DEFAULT_VISIBILITY: FriendVisibilitySettings = {
  showMembers: true,
  showGroups: false,
  showStructure: false,
  allowFrontingNotifications: true,
};

function makeRaw(overrides?: Partial<FriendConnectionRaw>): FriendConnectionRaw {
  return {
    id: "fc_test0001" as FriendConnectionId,
    accountId: "acc_test001" as AccountId,
    friendAccountId: "acc_test002" as AccountId,
    status: "accepted" as FriendConnectionStatus,
    assignedBucketIds: ["bkt_test0001" as BucketId],
    visibility: DEFAULT_VISIBILITY,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("narrowFriendConnection", () => {
  it("returns live entity with archived: false", () => {
    const result = narrowFriendConnection(makeRaw());
    expect(result.archived).toBe(false);
    expect(result.id).toBe("fc_test0001");
    expect(result.accountId).toBe("acc_test001");
    expect(result.friendAccountId).toBe("acc_test002");
    expect(result.status).toBe("accepted");
    expect(result.assignedBucketIds).toEqual(["bkt_test0001"]);
    expect(result.visibility).toEqual(DEFAULT_VISIBILITY);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("returns archived entity with archivedAt", () => {
    const result = narrowFriendConnection(makeRaw({ archived: true, archivedAt: LATER }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(LATER);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    expect(() => narrowFriendConnection(makeRaw({ archived: true, archivedAt: null }))).toThrow(
      "missing archivedAt",
    );
  });

  it("handles empty assignedBucketIds", () => {
    const result = narrowFriendConnection(makeRaw({ assignedBucketIds: [] }));
    expect(result.assignedBucketIds).toEqual([]);
  });

  it("handles pending status", () => {
    const result = narrowFriendConnection(makeRaw({ status: "pending" as FriendConnectionStatus }));
    expect(result.status).toBe("pending");
  });
});

describe("narrowFriendConnectionPage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = narrowFriendConnectionPage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowFriendConnectionPage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
