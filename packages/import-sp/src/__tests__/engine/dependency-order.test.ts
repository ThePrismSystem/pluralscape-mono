import { describe, expect, it } from "vitest";

import {
  collectionsAfter,
  DEPENDENCY_ORDER,
  nextCollection,
} from "../../engine/dependency-order.js";

import type { SpCollectionName } from "../../sources/sp-collections.js";

/**
 * Construct a value typed as SpCollectionName that is NOT present in
 * DEPENDENCY_ORDER. Used to exercise the undefined-index fallback branches.
 * The helper exists so the unsafe widening is confined to one place.
 */
function unknownCollectionName(): SpCollectionName {
  // `ORDER_INDEX` is a Map keyed by the 15 known names; any other string
  // will make `.get()` return undefined, hitting the fallback branch.
  const name: string = "notARealCollection";
  return name as SpCollectionName;
}

describe("DEPENDENCY_ORDER", () => {
  it("starts with system-level cherry-picks", () => {
    expect(DEPENDENCY_ORDER[0]).toBe("users");
    expect(DEPENDENCY_ORDER[1]).toBe("private");
  });

  it("places privacyBuckets before members", () => {
    expect(DEPENDENCY_ORDER.indexOf("privacyBuckets")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("members"),
    );
  });

  it("places customFields before members so info extraction can resolve field refs", () => {
    expect(DEPENDENCY_ORDER.indexOf("customFields")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("members"),
    );
  });

  it("places frontStatuses before frontHistory", () => {
    expect(DEPENDENCY_ORDER.indexOf("frontStatuses")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("frontHistory"),
    );
  });

  it("places members before groups", () => {
    expect(DEPENDENCY_ORDER.indexOf("members")).toBeLessThan(DEPENDENCY_ORDER.indexOf("groups"));
  });

  it("places frontHistory before comments", () => {
    expect(DEPENDENCY_ORDER.indexOf("frontHistory")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("comments"),
    );
  });

  it("places channelCategories before channels and channels before chatMessages", () => {
    expect(DEPENDENCY_ORDER.indexOf("channelCategories")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("channels"),
    );
    expect(DEPENDENCY_ORDER.indexOf("channels")).toBeLessThan(
      DEPENDENCY_ORDER.indexOf("chatMessages"),
    );
  });

  it("nextCollection returns the next collection in order", () => {
    expect(nextCollection("members")).toBe("groups");
  });

  it("nextCollection returns null for the last collection", () => {
    const last = DEPENDENCY_ORDER[DEPENDENCY_ORDER.length - 1];
    if (last === undefined) {
      throw new Error("DEPENDENCY_ORDER is empty");
    }
    expect(nextCollection(last)).toBeNull();
  });

  it("collectionsAfter returns the suffix starting at the given collection", () => {
    const after = collectionsAfter("groups");
    expect(after[0]).toBe("groups");
    expect(after).toContain("frontHistory");
  });

  it("nextCollection returns null for an unknown collection name", () => {
    const result = nextCollection(unknownCollectionName());
    expect(result).toBeNull();
  });

  it("collectionsAfter returns empty array for an unknown collection name", () => {
    const result = collectionsAfter(unknownCollectionName());
    expect(result).toEqual([]);
  });
});
