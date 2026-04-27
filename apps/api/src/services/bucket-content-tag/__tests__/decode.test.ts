import { brandId } from "@pluralscape/types";
import { describe, expect, expectTypeOf, it } from "vitest";

import { decodeBucketContentTagRow } from "../decode.js";

import type { BucketContentEntityType, BucketId, MemberId } from "@pluralscape/types";

// ── Constants ─────────────────────────────────────────────────────

const BUCKET_ID = brandId<BucketId>("bkt_550e8400-e29b-41d4-a716-446655440000");

// ── Tests ─────────────────────────────────────────────────────────

describe("decodeBucketContentTagRow", () => {
  it("narrows entityId to MemberId for member rows", () => {
    const decoded = decodeBucketContentTagRow({
      entityType: "member",
      entityId: "mem_e5800001-1111-1111-1111-111111111111",
      bucketId: BUCKET_ID,
    });

    expect(decoded.entityType).toBe("member");
    expect(decoded.bucketId).toBe(BUCKET_ID);
    if (decoded.entityType === "member") {
      // Compile-time narrowing: entityId is MemberId, not string.
      expectTypeOf(decoded.entityId).toEqualTypeOf<MemberId>();
      expect(decoded.entityId).toBe("mem_e5800001-1111-1111-1111-111111111111");
    }
  });

  it("narrows entityId to a structure-entity-type ID for structure-entity-type rows", () => {
    const decoded = decodeBucketContentTagRow({
      entityType: "structure-entity-type",
      entityId: "stet_e5800002-2222-2222-2222-222222222222",
      bucketId: BUCKET_ID,
    });

    expect(decoded.entityType).toBe("structure-entity-type");
    if (decoded.entityType === "structure-entity-type") {
      expect(decoded.entityId).toBe("stet_e5800002-2222-2222-2222-222222222222");
    }
  });

  it("decodes a fronting-comment row with the correct discriminant", () => {
    const decoded = decodeBucketContentTagRow({
      entityType: "fronting-comment",
      entityId: "fcom_e5800003-3333-3333-3333-333333333333",
      bucketId: BUCKET_ID,
    });

    expect(decoded.entityType).toBe("fronting-comment");
    expect(decoded.bucketId).toBe(BUCKET_ID);
  });

  it("throws on an unknown entityType — exhaustiveness lock", () => {
    // Cast through `BucketContentEntityType` to exercise the runtime guard.
    // The compile-time `_exhaustive: never` guarantees this branch is only
    // reachable if the type union diverges from the switch coverage.
    const sneaky = "totally-unknown" as BucketContentEntityType;
    expect(() =>
      decodeBucketContentTagRow({
        entityType: sneaky,
        entityId: "x_y",
        bucketId: BUCKET_ID,
      }),
    ).toThrow(/Unhandled BucketContentEntityType: totally-unknown/);
  });
});
