import { describe, expect, it } from "vitest";

import { narrowPrivacyBucket, narrowPrivacyBucketPage } from "../privacy-bucket.js";

import type { PrivacyBucketRaw } from "../privacy-bucket.js";
import type { BucketId, SystemId, UnixMillis } from "@pluralscape/types";

const NOW = 1_700_000_000_000 as UnixMillis;
const LATER = 1_700_002_000_000 as UnixMillis;

function makeRaw(overrides?: Partial<PrivacyBucketRaw>): PrivacyBucketRaw {
  return {
    id: "bkt_test0001" as BucketId,
    systemId: "sys_test001" as SystemId,
    name: "Friends",
    description: "Visible to close friends",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

describe("narrowPrivacyBucket", () => {
  it("returns live entity with archived: false", () => {
    const result = narrowPrivacyBucket(makeRaw());
    expect(result.archived).toBe(false);
    expect(result.id).toBe("bkt_test0001");
    expect(result.systemId).toBe("sys_test001");
    expect(result.name).toBe("Friends");
    expect(result.description).toBe("Visible to close friends");
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(NOW);
    expect(result.updatedAt).toBe(NOW);
  });

  it("returns archived entity with archivedAt", () => {
    const result = narrowPrivacyBucket(makeRaw({ archived: true, archivedAt: LATER }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(LATER);
    }
  });

  it("throws when archived=true but archivedAt is null", () => {
    expect(() => narrowPrivacyBucket(makeRaw({ archived: true, archivedAt: null }))).toThrow(
      "missing archivedAt",
    );
  });

  it("handles null description", () => {
    const result = narrowPrivacyBucket(makeRaw({ description: null }));
    expect(result.description).toBeNull();
  });
});

describe("narrowPrivacyBucketPage", () => {
  it("narrows all items and preserves cursor", () => {
    const page = { data: [makeRaw(), makeRaw()], nextCursor: "cursor_abc" };
    const result = narrowPrivacyBucketPage(page);
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("handles empty page", () => {
    const result = narrowPrivacyBucketPage({ data: [], nextCursor: null });
    expect(result.data).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
