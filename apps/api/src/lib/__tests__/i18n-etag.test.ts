import { describe, it, expect } from "vitest";

import { computeTranslationsEtag } from "../i18n-etag.js";

describe("computeTranslationsEtag", () => {
  it("is 16 hex chars", () => {
    const etag = computeTranslationsEtag({ a: "x" });
    expect(etag).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for identical content", () => {
    const a = computeTranslationsEtag({ a: "1", b: "2" });
    const b = computeTranslationsEtag({ a: "1", b: "2" });
    expect(a).toBe(b);
  });

  it("is deterministic across key order", () => {
    const a = computeTranslationsEtag({ a: "1", b: "2" });
    const b = computeTranslationsEtag({ b: "2", a: "1" });
    expect(a).toBe(b);
  });

  it("differs when content differs", () => {
    const a = computeTranslationsEtag({ a: "1" });
    const b = computeTranslationsEtag({ a: "2" });
    expect(a).not.toBe(b);
  });

  // The implementation defensively drops `undefined` entries before hashing,
  // so a map with an `undefined` value must produce the same etag as the same
  // map with that key omitted entirely. This guards against a future refactor
  // that accidentally keeps `undefined` values in the canonical JSON — which
  // would silently break ETag equality on the mobile client.
  it("ignores undefined values deterministically regardless of insertion order", () => {
    const a = computeTranslationsEtag({ a: "x", b: undefined });
    const b = computeTranslationsEtag({ b: undefined, a: "x" });
    const c = computeTranslationsEtag({ a: "x" });
    expect(a).toBe(c);
    expect(b).toBe(c);
  });
});
