import { describe, expect, it } from "vitest";

import { checkConditionalRequest, computeDataEtag } from "../../lib/etag.js";

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
