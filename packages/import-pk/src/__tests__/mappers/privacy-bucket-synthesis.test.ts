import { createMappingContext } from "@pluralscape/import-core";
import { describe, expect, it } from "vitest";

import { synthesizePkPrivacyBuckets } from "../../mappers/privacy-bucket-synthesis.js";

import type { PkMappedPrivacyBucket } from "../../mappers/privacy-bucket-synthesis.js";
import type { BatchMapperOutput, SourceDocument } from "@pluralscape/import-core";

function makeScanDoc(
  members: readonly { pkMemberId: string; privacy?: Record<string, string> }[],
): SourceDocument {
  return {
    sourceId: "synthetic:privacy-scan",
    document: { type: "privacy-scan", members },
  };
}

function payload(output: BatchMapperOutput): PkMappedPrivacyBucket {
  if (output.result.status !== "mapped") {
    throw new Error(`Expected mapped, got ${output.result.status}`);
  }
  return output.result.payload as PkMappedPrivacyBucket;
}

describe("synthesizePkPrivacyBuckets", () => {
  it("produces no bucket when all members are all-public", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");
    ctx.register("member", "m2", "ps_m2");

    const docs = [
      makeScanDoc([
        { pkMemberId: "m1", privacy: { visibility: "public", name_privacy: "public" } },
        { pkMemberId: "m2", privacy: { visibility: "public" } },
      ]),
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);
    expect(results).toHaveLength(0);
  });

  it("creates a PK Private bucket when one member has one private field", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");
    ctx.register("member", "m2", "ps_m2");

    const docs = [
      makeScanDoc([
        { pkMemberId: "m1", privacy: { visibility: "public" } },
        { pkMemberId: "m2", privacy: { visibility: "private" } },
      ]),
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(1);
    const bucket = results[0];
    if (bucket !== undefined) {
      expect(bucket.sourceEntityId).toBe("synthetic:pk-private");
      const p = payload(bucket);
      expect(p.encrypted.name).toBe("PK Private");
      expect(p.encrypted.description).toMatch(/PluralKit/i);
    }

    // The private member's resolved ID should be stored in context metadata
    const privateMemberIds = ctx.getMetadata("privacy-bucket", "synthetic:pk-private", "memberIds");
    expect(privateMemberIds).toEqual(["ps_m2"]);
  });

  it("creates a bucket with multiple private members from mixed privacy", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");
    ctx.register("member", "m2", "ps_m2");
    ctx.register("member", "m3", "ps_m3");

    const docs = [
      makeScanDoc([
        { pkMemberId: "m1", privacy: { visibility: "public" } },
        { pkMemberId: "m2", privacy: { description_privacy: "private" } },
        { pkMemberId: "m3", privacy: { avatar_privacy: "private", banner_privacy: "private" } },
      ]),
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(1);
    const privateMemberIds = ctx.getMetadata("privacy-bucket", "synthetic:pk-private", "memberIds");
    expect(privateMemberIds).toEqual(["ps_m2", "ps_m3"]);
  });

  it("creates a bucket when all members are all-private", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");
    ctx.register("member", "m2", "ps_m2");

    const docs = [
      makeScanDoc([
        { pkMemberId: "m1", privacy: { visibility: "private" } },
        { pkMemberId: "m2", privacy: { name_privacy: "private" } },
      ]),
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(1);
    const privateMemberIds = ctx.getMetadata("privacy-bucket", "synthetic:pk-private", "memberIds");
    expect(privateMemberIds).toEqual(["ps_m1", "ps_m2"]);
  });

  it("produces no bucket and emits a warning when members array is empty", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });

    const docs = [makeScanDoc([])];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(0);
    expect(ctx.warnings.some((w) => w.message.includes("privacy"))).toBe(true);
  });

  it("produces no bucket and emits a warning when given no documents", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const results = synthesizePkPrivacyBuckets([], ctx);

    expect(results).toHaveLength(0);
    expect(ctx.warnings.some((w) => w.message.includes("privacy"))).toBe(true);
  });

  it("produces no bucket and emits a warning when document fails validation", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const docs: SourceDocument[] = [
      { sourceId: "bad-scan", document: { type: "wrong-type", members: [] } },
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(0);
    expect(ctx.warnings.some((w) => w.message.includes("validation failed"))).toBe(true);
  });

  it("checks all privacy fields, not just visibility", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");

    const docs = [
      makeScanDoc([
        {
          pkMemberId: "m1",
          privacy: {
            visibility: "public",
            name_privacy: "public",
            description_privacy: "public",
            birthday_privacy: "public",
            pronoun_privacy: "public",
            avatar_privacy: "public",
            banner_privacy: "public",
            metadata_privacy: "private",
            proxy_privacy: "public",
          },
        },
      ]),
    ];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(1);
    const privateMemberIds = ctx.getMetadata("privacy-bucket", "synthetic:pk-private", "memberIds");
    expect(privateMemberIds).toEqual(["ps_m1"]);
  });

  it("skips members with undefined privacy (treats as public)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "m1", "ps_m1");

    const docs = [makeScanDoc([{ pkMemberId: "m1" }])];
    const results = synthesizePkPrivacyBuckets(docs, ctx);

    expect(results).toHaveLength(0);
  });
});
