import { describe, expect, it } from "vitest";

import { mapBucket, synthesizeLegacyBuckets } from "../../mappers/bucket.mapper.js";
import { createMappingContext } from "../../mappers/context.js";

import type { SPPrivacyBucket } from "../../sources/sp-types.js";

describe("mapBucket", () => {
  it("maps a minimal bucket", () => {
    const sp: SPPrivacyBucket = { _id: "bk1", name: "Trusted" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapBucket(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.name).toBe("Trusted");
      expect(result.payload.color).toBeNull();
      expect(result.payload.description).toBeNull();
      expect(result.payload.icon).toBeNull();
    }
  });

  it("preserves desc and color", () => {
    const sp: SPPrivacyBucket = {
      _id: "bk2",
      name: "Inner Circle",
      desc: "for close friends",
      color: "#aabbcc",
    };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapBucket(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.description).toBe("for close friends");
      expect(result.payload.color).toBe("#aabbcc");
    }
  });

  it("emits a warning and skips when name is empty", () => {
    const sp: SPPrivacyBucket = { _id: "bk3", name: "" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapBucket(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("privacy-bucket");
    expect(ctx.warnings[0]?.entityId).toBe("bk3");
  });
});

describe("synthesizeLegacyBuckets", () => {
  it("returns three synthetic buckets when no existing buckets match", () => {
    const result = synthesizeLegacyBuckets({ existingBucketNames: [] });
    expect(result).toHaveLength(3);
    expect(result.map((b) => b.name)).toEqual(["Public", "Trusted", "Private"]);
    expect(result.map((b) => b.syntheticSourceId)).toEqual([
      "synthetic:public",
      "synthetic:trusted",
      "synthetic:private",
    ]);
    expect(result.every((b) => b.reusedPluralscapeId === undefined)).toBe(true);
  });

  it("reuses existing buckets matched case-insensitively by name", () => {
    const result = synthesizeLegacyBuckets({
      existingBucketNames: [
        { name: "public", pluralscapeId: "bkt_pub" },
        { name: "PRIVATE", pluralscapeId: "bkt_priv" },
      ],
    });
    expect(result.find((b) => b.name === "Public")?.reusedPluralscapeId).toBe("bkt_pub");
    expect(result.find((b) => b.name === "Private")?.reusedPluralscapeId).toBe("bkt_priv");
    expect(result.find((b) => b.name === "Trusted")?.reusedPluralscapeId).toBeUndefined();
  });
});
