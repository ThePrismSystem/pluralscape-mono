import { describe, expect, it } from "vitest";

import {
  DEFAULT_OWNER_FULL_PROFILE,
  DEFAULT_OWNER_LITE_PROFILE,
  type DocumentSyncState,
  type FriendProfile,
  type OnDemandLoadRequest,
  type ReplicationProfile,
  type SubscriptionSet,
} from "../replication-profiles.js";

import { asSyncDocId } from "./test-crypto-helpers.js";

import type { SyncManifestEntry } from "../adapters/network-adapter.js";

// ── DEFAULT_OWNER_FULL_PROFILE ───────────────────────────────────────

describe("DEFAULT_OWNER_FULL_PROFILE", () => {
  it("profileType is 'owner-full'", () => {
    expect(DEFAULT_OWNER_FULL_PROFILE.profileType).toBe("owner-full");
  });
});

// ── DEFAULT_OWNER_LITE_PROFILE ───────────────────────────────────────

describe("DEFAULT_OWNER_LITE_PROFILE", () => {
  it("profileType is 'owner-lite'", () => {
    expect(DEFAULT_OWNER_LITE_PROFILE.profileType).toBe("owner-lite");
  });

  it("activeChannelWindowDays is 30", () => {
    expect(DEFAULT_OWNER_LITE_PROFILE.activeChannelWindowDays).toBe(30);
  });
});

// ── ReplicationProfile union ─────────────────────────────────────────

describe("ReplicationProfile union", () => {
  it("discriminates on profileType", () => {
    const profiles: ReplicationProfile[] = [
      { profileType: "owner-full" },
      { profileType: "owner-lite", activeChannelWindowDays: 30 },
      { profileType: "friend", friendSystemId: "sys_friend", grantedBucketIds: ["bucket_1"] },
    ];

    for (const profile of profiles) {
      switch (profile.profileType) {
        case "owner-full":
          expect(profile.profileType).toBe("owner-full");
          break;
        case "owner-lite":
          expect(profile.activeChannelWindowDays).toBe(30);
          break;
        case "friend":
          expect(profile.friendSystemId).toBe("sys_friend");
          break;
        default: {
          const _exhaustive: never = profile;
          throw new Error(
            `Unexpected profile type: ${(_exhaustive as ReplicationProfile).profileType}`,
          );
        }
      }
    }

    expect(profiles).toHaveLength(3);
  });
});

// ── FriendProfile ────────────────────────────────────────────────────

describe("FriendProfile", () => {
  it("grantedBucketIds is an array (not a Set)", () => {
    const profile: FriendProfile = {
      profileType: "friend",
      friendSystemId: "sys_friend",
      grantedBucketIds: ["bucket_1", "bucket_2"],
    };
    expect(Array.isArray(profile.grantedBucketIds)).toBe(true);
    expect(profile.grantedBucketIds).toHaveLength(2);
  });
});

// ── OnDemandLoadRequest ──────────────────────────────────────────────

describe("OnDemandLoadRequest", () => {
  it("has docId and persist fields", () => {
    const req: OnDemandLoadRequest = {
      docId: asSyncDocId("fronting-sys_abc-2025-Q4"),
      persist: true,
    };
    expect(req.docId).toBe("fronting-sys_abc-2025-Q4");
    expect(req.persist).toBe(true);
  });

  it("does not include protocol fields type or correlationId", () => {
    const req: OnDemandLoadRequest = {
      docId: asSyncDocId("journal-sys_abc-2026"),
      persist: false,
    };
    // OnDemandLoadRequest does not extend SyncMessageBase — verify at runtime
    expect(Object.keys(req)).not.toContain("type");
    expect(Object.keys(req)).not.toContain("correlationId");
  });
});

// ── SubscriptionSet ──────────────────────────────────────────────────

describe("SubscriptionSet", () => {
  it("has active, available, evict fields", () => {
    const entry: SyncManifestEntry = {
      docId: asSyncDocId("system-core-sys_abc"),
      docType: "system-core",
      keyType: "derived",
      bucketId: null,
      channelId: null,
      timePeriod: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sizeBytes: 1024,
      snapshotVersion: 1,
      lastSeq: 1,
      archived: false,
    };

    const set: SubscriptionSet = {
      active: [entry],
      available: [],
      evict: [asSyncDocId("old-doc-id")],
    };

    expect(set.active).toHaveLength(1);
    expect(set.available).toHaveLength(0);
    expect(set.evict).toEqual([asSyncDocId("old-doc-id")]);
  });
});

// ── DocumentSyncState ────────────────────────────────────────────────

describe("DocumentSyncState", () => {
  it("has docId, lastSyncedSeq, lastSnapshotVersion, onDemand fields", () => {
    const state: DocumentSyncState = {
      docId: asSyncDocId("chat-ch_xyz-2026-03"),
      lastSyncedSeq: 42,
      lastSnapshotVersion: 2,
      onDemand: true,
    };

    expect(state.docId).toBe("chat-ch_xyz-2026-03");
    expect(state.lastSyncedSeq).toBe(42);
    expect(state.lastSnapshotVersion).toBe(2);
    expect(state.onDemand).toBe(true);
  });
});
