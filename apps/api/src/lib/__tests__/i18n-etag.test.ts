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
});
