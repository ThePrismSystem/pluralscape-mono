import { describe, expect, it } from "vitest";

import { filterManifest } from "../subscription-filter.js";

import type { SyncManifestEntry } from "../adapters/network-adapter.js";
import type {
  FriendProfile,
  OwnerLiteProfile,
  ReplicationProfile,
} from "../replication-profiles.js";

function entry(
  overrides: Partial<SyncManifestEntry> & { docId: string; docType: SyncManifestEntry["docType"] },
): SyncManifestEntry {
  return {
    keyType: "master",
    bucketId: undefined,
    channelId: undefined,
    timePeriod: null,
    createdAt: 1000,
    updatedAt: 1000,
    sizeBytes: 100,
    snapshotVersion: 1,
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
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "fronting-sys_a", docType: "fronting" }),
        entry({ docId: "chat-ch_a", docType: "chat" }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.active).toHaveLength(3);
    expect(result.available).toHaveLength(0);
  });

  it("archived entries go to available", () => {
    const manifest = {
      documents: [
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({
          docId: "fronting-sys_a-2025-Q1",
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
      documents: [entry({ docId: "system-core-sys_a", docType: "system-core" })],
    };
    const result = filterManifest(manifest, profile, ["system-core-sys_a", "old-doc-sys_x"]);
    expect(result.evict).toEqual(["old-doc-sys_x"]);
  });

  it("local docs in manifest are not evicted", () => {
    const manifest = {
      documents: [
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "fronting-sys_a", docType: "fronting" }),
      ],
    };
    const result = filterManifest(manifest, profile, ["system-core-sys_a", "fronting-sys_a"]);
    expect(result.evict).toHaveLength(0);
  });
});

describe("filterManifest — owner-lite", () => {
  const profile: OwnerLiteProfile = { profileType: "owner-lite", activeChannelWindowDays: 30 };

  it("system-core, privacy-config, and bucket are always active", () => {
    const manifest = {
      documents: [
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "privacy-config-sys_a", docType: "privacy-config" }),
        entry({ docId: "bucket-bkt_a", docType: "bucket", keyType: "bucket", bucketId: "bkt_a" }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(3);
  });

  it("fronting current period is active, historical is available", () => {
    const manifest = {
      documents: [
        entry({ docId: "fronting-sys_a-2026-Q1", docType: "fronting", timePeriod: "2026-Q1" }),
        entry({ docId: "fronting-sys_a-2025-Q4", docType: "fronting", timePeriod: "2025-Q4" }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active.map((e) => e.docId)).toEqual(["fronting-sys_a-2026-Q1"]);
    expect(result.available.map((e) => e.docId)).toEqual(["fronting-sys_a-2025-Q4"]);
  });

  it("fronting base doc (no period) is active when no splits exist", () => {
    const manifest = {
      documents: [entry({ docId: "fronting-sys_a", docType: "fronting" })],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(1);
  });

  it("chat active channel in current period is active", () => {
    const recentUpdate = NOW - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    const manifest = {
      documents: [
        entry({ docId: "chat-ch_a", docType: "chat", channelId: "ch_a", updatedAt: recentUpdate }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(1);
  });

  it("chat inactive channel goes to available", () => {
    const oldUpdate = NOW - 60 * 24 * 60 * 60 * 1000; // 60 days ago
    const manifest = {
      documents: [
        entry({ docId: "chat-ch_a", docType: "chat", channelId: "ch_a", updatedAt: oldUpdate }),
      ],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(1);
  });

  it("journal is always available (never active in lite)", () => {
    const manifest = {
      documents: [entry({ docId: "journal-sys_a", docType: "journal" })],
    };
    const result = filterManifest(manifest, profile, [], NOW);
    expect(result.active).toHaveLength(0);
    expect(result.available).toHaveLength(1);
  });

  it("archived entries go to available regardless of type", () => {
    const manifest = {
      documents: [
        entry({
          docId: "fronting-sys_a-2026-Q1",
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
          docId: "bucket-bkt_shared",
          docType: "bucket",
          keyType: "bucket",
          bucketId: "bkt_shared",
        }),
        entry({
          docId: "bucket-bkt_other",
          docType: "bucket",
          keyType: "bucket",
          bucketId: "bkt_other",
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
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "fronting-sys_a", docType: "fronting" }),
        entry({
          docId: "bucket-bkt_shared",
          docType: "bucket",
          keyType: "bucket",
          bucketId: "bkt_shared",
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
          docId: "bucket-bkt_shared",
          docType: "bucket",
          keyType: "bucket",
          bucketId: "bkt_shared",
        }),
      ],
    };
    // Local has a bucket that's no longer granted
    const result = filterManifest(manifest, profile, ["bucket-bkt_shared", "bucket-bkt_revoked"]);
    expect(result.evict).toEqual(["bucket-bkt_revoked"]);
  });

  it("no available docs for friend profile", () => {
    const manifest = {
      documents: [
        entry({
          docId: "bucket-bkt_shared",
          docType: "bucket",
          keyType: "bucket",
          bucketId: "bkt_shared",
        }),
      ],
    };
    const result = filterManifest(manifest, profile, []);
    expect(result.available).toHaveLength(0);
  });
});

describe("filterManifest — lifecycle integration", () => {
  it("re-filter after manifest change updates subscription set", () => {
    const profile: ReplicationProfile = { profileType: "owner-full" };

    const manifest1 = {
      documents: [
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "fronting-sys_a", docType: "fronting" }),
      ],
    };
    const result1 = filterManifest(manifest1, profile, []);
    expect(result1.active).toHaveLength(2);

    // Manifest changes: fronting doc removed, new chat doc added
    const manifest2 = {
      documents: [
        entry({ docId: "system-core-sys_a", docType: "system-core" }),
        entry({ docId: "chat-ch_a", docType: "chat" }),
      ],
    };
    const localIds = result1.active.map((e) => e.docId);
    const result2 = filterManifest(manifest2, profile, localIds);

    expect(result2.active).toHaveLength(2);
    expect(result2.evict).toEqual(["fronting-sys_a"]);
  });
});
