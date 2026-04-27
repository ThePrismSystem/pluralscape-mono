import { brandId, BUCKET_CONTENT_ENTITY_TYPES, ID_PREFIXES } from "@pluralscape/types";
import { describe, expect, expectTypeOf, it } from "vitest";

import { decodeBucketContentTagRow, decodeBucketContentTagRowSafe } from "../decode.js";

import type { BucketContentEntityType, BucketId, MemberId } from "@pluralscape/types";

// ── Constants ─────────────────────────────────────────────────────

const BUCKET_ID = brandId<BucketId>("bkt_550e8400-e29b-41d4-a716-446655440000");

/**
 * Mapping from {@link BucketContentEntityType} (kebab-case) to its
 * {@link ID_PREFIXES} key (camelCase). Required because the union literals
 * differ in casing from the prefix-table keys, but each entityType has
 * exactly one ID prefix in the table.
 */
const ID_PREFIX_KEY: Record<
  (typeof BUCKET_CONTENT_ENTITY_TYPES)[number],
  keyof typeof ID_PREFIXES
> = {
  member: "member",
  group: "group",
  channel: "channel",
  message: "message",
  note: "note",
  poll: "poll",
  relationship: "relationship",
  "structure-entity-type": "structureEntityType",
  "structure-entity": "structureEntity",
  "journal-entry": "journalEntry",
  "wiki-page": "wikiPage",
  "custom-front": "customFront",
  "fronting-session": "frontingSession",
  "board-message": "boardMessage",
  acknowledgement: "acknowledgement",
  "innerworld-entity": "innerWorldEntity",
  "innerworld-region": "innerWorldRegion",
  "field-definition": "fieldDefinition",
  "field-value": "fieldValue",
  "member-photo": "memberPhoto",
  "fronting-comment": "frontingComment",
};

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

describe("decodeBucketContentTagRow — fleet parity", () => {
  it.each(BUCKET_CONTENT_ENTITY_TYPES)(
    "decodes a row of entityType %s with the matching prefix",
    (entityType) => {
      const prefix = ID_PREFIXES[ID_PREFIX_KEY[entityType]];
      const entityId = `${prefix}00000000-0000-0000-0000-000000000001`;

      const decoded = decodeBucketContentTagRow({ entityType, entityId, bucketId: BUCKET_ID });

      expect(decoded.entityType).toBe(entityType);
      expect(decoded.entityId).toBe(entityId);
      expect(decoded.bucketId).toBe(BUCKET_ID);
    },
  );
});

describe("decodeBucketContentTagRowSafe", () => {
  it.each(BUCKET_CONTENT_ENTITY_TYPES)(
    "returns a decoded tag for entityType %s with the matching prefix",
    (entityType) => {
      const prefix = ID_PREFIXES[ID_PREFIX_KEY[entityType]];
      const entityId = `${prefix}00000000-0000-0000-0000-000000000001`;

      const result = decodeBucketContentTagRowSafe({ entityType, entityId, bucketId: BUCKET_ID });

      expect(result).not.toBeNull();
      expect(result?.entityType).toBe(entityType);
      expect(result?.entityId).toBe(entityId);
      expect(result?.bucketId).toBe(BUCKET_ID);
    },
  );

  it("returns null for an unknown entityType — resilient list path", () => {
    const result = decodeBucketContentTagRowSafe({
      entityType: "totally-unknown",
      entityId: "x_y",
      bucketId: BUCKET_ID,
    });

    expect(result).toBeNull();
  });
});
