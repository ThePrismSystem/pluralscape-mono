import { describe, expect, it } from "vitest";

import {
  collectionsAfter,
  DEPENDENCY_ORDER,
  nextCollection,
} from "../../engine/dependency-order.js";

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
});
