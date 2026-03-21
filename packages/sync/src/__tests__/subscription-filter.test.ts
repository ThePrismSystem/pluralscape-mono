import { describe, expect, it } from "vitest";

import { filterManifest } from "../subscription-filter.js";

import { docId } from "./test-crypto-helpers.js";

import type { SyncManifestEntry } from "../adapters/network-adapter.js";
import type {
  FriendProfile,
  OwnerLiteProfile,
  ReplicationProfile,
} from "../replication-profiles.js";
import type { BucketId, ChannelId, SyncDocumentId } from "@pluralscape/types";

/** Cast a string to BucketId for test fixtures. */
const bid = (id: string): BucketId => id as BucketId;
/** Cast a string to ChannelId for test fixtures. */
const cid = (id: string): ChannelId => id as ChannelId;

function entry(
  overrides: Partial<SyncManifestEntry> & {
    docId: SyncDocumentId;
    docType: SyncManifestEntry["docType"];
  },
): SyncManifestEntry {
  return {
    keyType: "derived",
    bucketId: null,
    channelId: null,
    timePeriod: null,
    createdAt: 1000,
    updatedAt: 1000,
    sizeBytes: 100,
    snapshotVersion: 1,
    lastSeq: 1,
    archived: false,
    ...overrides,
  };
}

const NOW = Date.UTC(2026, 2, 15); // March 15, 2026

describe("filterManifest — owner-full", () => {
  const profile: ReplicationProfile = { profileType: "owner-full" };

  it("all non-archived entries are active", () => {
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("fronting-sys_a"), docType: "fronting" }),
        entry({ docId: docId("chat-ch_a"), docType: "chat" }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.active).toHaveLength(3);
    expect(result.available).toHaveLength(0);
  });

  it("archived entries go to available", () => {
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({
          docId: docId("fronting-sys_a-2025-Q1"),
          docType: "fronting",
          timePeriod: "2025-Q1",
          archived: true,
        }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.active).toHaveLength(1);
    expect(result.available).toHaveLength(1);
    expect(result.available[0]?.docId).toBe("fronting-sys_a-2025-Q1");
  });

  it("computes evict from local docs not in manifest", () => {
    const manifest = {
      documents: [entry({ docId: docId("system-core-sys_a"), docType: "system-core" })],
    };
    const result = filterManifest(manifest, profile, [
      docId("system-core-sys_a"),
      docId("old-doc-sys_x"),
    ]);
    expect(result.evict).toEqual(["old-doc-sys_x"]);
  });

  it("local docs in manifest are not evicted", () => {
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("fronting-sys_a"), docType: "fronting" }),
      ],
    };
    const result = filterManifest(manifest, profile, [
      docId("system-core-sys_a"),
      docId("fronting-sys_a"),
    ]);
    expect(result.evict).toHaveLength(0);
  });
});

describe("filterManifest — owner-lite", () => {
  const profile: OwnerLiteProfile = { profileType: "owner-lite", activeChannelWindowDays: 30 };

  it("system-core, privacy-config, and bucket are always active", () => {
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("privacy-config-sys_a"), docType: "privacy-config" }),
        entry({
          docId: docId("bucket-bkt_a"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_a"),
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(3);
  });

  it("fronting current period is active, historical is available", () => {
    const manifest = {
      documents: [
        entry({
          docId: docId("fronting-sys_a-2026-Q1"),
          docType: "fronting",
          timePeriod: "2026-Q1",
        }),
        entry({
          docId: docId("fronting-sys_a-2025-Q4"),
          docType: "fronting",
          timePeriod: "2025-Q4",
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active.map((e) => e.docId)).toEqual(["fronting-sys_a-2026-Q1"]);
    expect(result.available.map((e) => e.docId)).toEqual(["fronting-sys_a-2025-Q4"]);
  });

  it("fronting base doc (no period) is active when no splits exist", () => {
    const manifest = {
      documents: [entry({ docId: docId("fronting-sys_a"), docType: "fronting" })],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(1);
  });

  it("chat active channel in current period is active", () => {
    const recentUpdate = NOW - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    const manifest = {
      documents: [
        entry({
          docId: docId("chat-ch_a"),
          docType: "chat",
          channelId: cid("ch_a"),
          updatedAt: recentUpdate,
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(1);
  });

  it("chat inactive channel goes to available", () => {
    const oldUpdate = NOW - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const manifest = {
      documents: [
        entry({
          docId: docId("chat-ch_a"),
          docType: "chat",
          channelId: cid("ch_a"),
          updatedAt: oldUpdate,
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(1);
  });

  it("journal is always available (never active in lite)", () => {
    const manifest = {
      documents: [entry({ docId: docId("journal-sys_a"), docType: "journal" })],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(1);
  });

  it("archived entries go to available regardless of type", () => {
    const manifest = {
      documents: [
        entry({
          docId: docId("fronting-sys_a-2026-Q1"),
          docType: "fronting",
          timePeriod: "2026-Q1",
          archived: true,
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(1);
  });
});

describe("filterManifest — friend", () => {
  const profile: FriendProfile = {
    profileType: "friend",
    friendSystemId: "sys_friend",
    grantedBucketIds: ["bkt_shared"],
  };

  it("only granted bucket docs are active", () => {
    const manifest = {
      documents: [
        entry({
          docId: docId("bucket-bkt_shared"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_shared"),
        }),
        entry({
          docId: docId("bucket-bkt_other"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_other"),
        }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.active).toHaveLength(1);
    expect(result.active[0]?.docId).toBe("bucket-bkt_shared");
  });

  it("non-bucket types are excluded", () => {
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("fronting-sys_a"), docType: "fronting" }),
        entry({
          docId: docId("bucket-bkt_shared"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_shared"),
        }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.active).toHaveLength(1);
  });

  it("revoked grants are evicted from local storage", () => {
    const manifest = {
      documents: [
        entry({
          docId: docId("bucket-bkt_shared"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_shared"),
        }),
      ],
    };
    // Local has a bucket that's no longer granted
    const result = filterManifest(manifest, profile, [
      docId("bucket-bkt_shared"),
      docId("bucket-bkt_revoked"),
    ]);
    expect(result.evict).toEqual(["bucket-bkt_revoked"]);
  });

  it("no available docs for friend profile", () => {
    const manifest = {
      documents: [
        entry({
          docId: docId("bucket-bkt_shared"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_shared"),
        }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.available).toHaveLength(0);
  });
});

describe("filterManifest — malformed docIds", () => {
  it("owner-lite skips entries with unparseable docIds", () => {
    const profile: OwnerLiteProfile = { profileType: "owner-lite", activeChannelWindowDays: 30 };
    const manifest = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("not-a-valid-id"), docType: "fronting" }),
        entry({ docId: docId("fronting-sys_a"), docType: "fronting" }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    // Malformed entry is silently skipped, other entries classified normally
    expect(result.active.map((e) => e.docId)).toContain("system-core-sys_a");
    expect(result.active.map((e) => e.docId)).toContain("fronting-sys_a");
    expect(result.active.map((e) => e.docId)).not.toContain("not-a-valid-id");
    expect(result.available.map((e) => e.docId)).not.toContain("not-a-valid-id");
  });
});

describe("filterManifest — empty manifests", () => {
  it("owner-full with empty manifest returns empty sets", () => {
    const profile: ReplicationProfile = { profileType: "owner-full" };
    const result = filterManifest({ documents: [] }, profile, []);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(0);
    expect(result.evict).toHaveLength(0);
  });

  it("owner-lite with empty manifest returns empty sets", () => {
    const profile: OwnerLiteProfile = { profileType: "owner-lite", activeChannelWindowDays: 30 };
    const result = filterManifest({ documents: [] }, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(0);
  });

  it("friend with empty manifest returns empty sets", () => {
    const profile: FriendProfile = {
      profileType: "friend",
      friendSystemId: "sys_friend",
      grantedBucketIds: ["bkt_a"],
    };
    const result = filterManifest({ documents: [] }, profile, []);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(0);
  });
});

describe("filterManifest — friend edge cases", () => {
  it("empty grantedBucketIds results in no active docs and eviction of locals", () => {
    const profile: FriendProfile = {
      profileType: "friend",
      friendSystemId: "sys_friend",
      grantedBucketIds: [],
    };
    const manifest = {
      documents: [
        entry({
          docId: docId("bucket-bkt_a"),
          docType: "bucket",
          keyType: "bucket",
          bucketId: bid("bkt_a"),
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [docId("bucket-bkt_old")]);
    expect(result.active).toHaveLength(0);
    expect(result.evict).toContain("bucket-bkt_old");
  });
});

describe("filterManifest — chat time-split edge cases", () => {
  it("chat current period but outside activity window goes to available", () => {
    const profile: OwnerLiteProfile = { profileType: "owner-lite", activeChannelWindowDays: 30 };
    const oldUpdate = NOW - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const manifest = {
      documents: [
        entry({
          docId: docId("chat-ch_a-2026-03"),
          docType: "chat",
          channelId: cid("ch_a"),
          timePeriod: "2026-03",
          updatedAt: oldUpdate,
        }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    // Current period but outside window → available, not active
    expect(result.available).toHaveLength(1);
    expect(result.active).toHaveLength(0);
  });
});

describe("filterManifest — lifecycle integration", () => {
  it("re-filter after manifest change updates subscription set", () => {
    const profile: ReplicationProfile = { profileType: "owner-full" };

    const manifest1 = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("fronting-sys_a"), docType: "fronting" }),
      ],
    };
    const result1 = filterManifest(manifest1, profile, []);
    expect(result1.active).toHaveLength(2);

    // Manifest changes: fronting doc removed, new chat doc added
    const manifest2 = {
      documents: [
        entry({ docId: docId("system-core-sys_a"), docType: "system-core" }),
        entry({ docId: docId("chat-ch_a"), docType: "chat" }),
      ],
    };
    const localIds = result1.active.map((e) => e.docId);
    const result2 = filterManifest(manifest2, profile, localIds);

    expect(result2.active).toHaveLength(2);
    expect(result2.evict).toEqual(["fronting-sys_a"]);
  });
});
