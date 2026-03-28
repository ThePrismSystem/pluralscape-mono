import { describe, expect, it } from "vitest";

import { checkConditionalRequest, computeDataEtag, computeManifestEtag } from "../../lib/etag.js";

import type { UnixMillis } from "@pluralscape/types";

const ts = (v: number): UnixMillis => v as UnixMillis;

describe("computeDataEtag", () => {
  it("returns a weak ETag string", () => {
    const etag = computeDataEtag(ts(1000), 5);
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("is deterministic — same inputs produce same output", () => {
    const a = computeDataEtag(ts(12345), 10);
    const b = computeDataEtag(ts(12345), 10);
    expect(a).toBe(b);
  });

  it("changes when maxUpdatedAt changes", () => {
    const a = computeDataEtag(ts(1000), 5);
    const b = computeDataEtag(ts(2000), 5);
    expect(a).not.toBe(b);
  });

  it("changes when entityCount changes", () => {
    const a = computeDataEtag(ts(1000), 5);
    const b = computeDataEtag(ts(1000), 6);
    expect(a).not.toBe(b);
  });

  it("handles null maxUpdatedAt", () => {
    const etag = computeDataEtag(null, 0);
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("produces different ETags for null vs zero timestamp", () => {
    const a = computeDataEtag(null, 1);
    const b = computeDataEtag(ts(0), 1);
    expect(a).not.toBe(b);
  });
});

describe("checkConditionalRequest", () => {
  it("returns false when requestEtag is undefined", () => {
    expect(checkConditionalRequest(undefined, 'W/"abc"')).toBe(false);
  });

  it("returns true when ETags match", () => {
    expect(checkConditionalRequest('W/"abc"', 'W/"abc"')).toBe(true);
  });

  it("returns false when ETags differ", () => {
    expect(checkConditionalRequest('W/"abc"', 'W/"def"')).toBe(false);
  });

  it("returns true for wildcard *", () => {
    expect(checkConditionalRequest("*", 'W/"abc"')).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(checkConditionalRequest("", 'W/"abc"')).toBe(false);
  });

  it("returns true when ETag appears in comma-separated list", () => {
    expect(checkConditionalRequest('W/"aaa", W/"abc", W/"def"', 'W/"abc"')).toBe(true);
  });

  it("returns false when no ETag in comma-separated list matches", () => {
    expect(checkConditionalRequest('W/"aaa", W/"bbb"', 'W/"abc"')).toBe(false);
  });
});

describe("computeManifestEtag", () => {
  it("returns a weak ETag string", () => {
    const etag = computeManifestEtag([{ count: 5, lastUpdatedAt: ts(1000) }]);
    expect(etag).toMatch(/^W\/"[0-9a-f]{16}"$/);
  });

  it("is equivalent to computeDataEtag with derived values", () => {
    const entries = [
      { count: 3, lastUpdatedAt: ts(1000) },
      { count: 7, lastUpdatedAt: ts(2000) },
    ];
    // globalMaxUpdatedAt = 2000, totalCount = 10
    expect(computeManifestEtag(entries)).toBe(computeDataEtag(ts(2000), 10));
  });

  it("handles empty entries array", () => {
    const etag = computeManifestEtag([]);
    expect(etag).toBe(computeDataEtag(null, 0));
  });

  it("handles all-null lastUpdatedAt entries", () => {
    const entries = [
      { count: 2, lastUpdatedAt: null },
      { count: 3, lastUpdatedAt: null },
    ];
    expect(computeManifestEtag(entries)).toBe(computeDataEtag(null, 5));
  });

  it("picks the max lastUpdatedAt across entries", () => {
    const entries = [
      { count: 1, lastUpdatedAt: ts(500) },
      { count: 1, lastUpdatedAt: ts(3000) },
      { count: 1, lastUpdatedAt: ts(1500) },
    ];
    expect(computeManifestEtag(entries)).toBe(computeDataEtag(ts(3000), 3));
  });

  it("skips null entries when computing max", () => {
    const entries = [
      { count: 1, lastUpdatedAt: null },
      { count: 2, lastUpdatedAt: ts(1000) },
      { count: 0, lastUpdatedAt: null },
    ];
    expect(computeManifestEtag(entries)).toBe(computeDataEtag(ts(1000), 3));
  });

  it("is deterministic", () => {
    const entries = [
      { count: 5, lastUpdatedAt: ts(1000) },
      { count: 10, lastUpdatedAt: ts(2000) },
    ];
    expect(computeManifestEtag(entries)).toBe(computeManifestEtag(entries));
  });
});
