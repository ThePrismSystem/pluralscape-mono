import { describe, expect, it } from "vitest";

import {
  booleanQueryParam,
  optionalBooleanQueryParam,
  IncludeArchivedQuerySchema,
  InnerWorldEntityQuerySchema,
  LifecycleEventQuerySchema,
  RelationshipQuerySchema,
  StructureEntityLinkQuerySchema,
  StructureEntityMemberLinkQuerySchema,
  StructureEntityAssociationQuerySchema,
} from "../query-params.js";

// ── booleanQueryParam ────────────────────────────────────────────

describe("booleanQueryParam", () => {
  it("coerces 'true' to true", () => {
    const result = booleanQueryParam.safeParse("true");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  it("coerces 'false' to false", () => {
    const result = booleanQueryParam.safeParse("false");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  it("coerces undefined to false", () => {
    const result = booleanQueryParam.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  it("rejects 'yes'", () => {
    const result = booleanQueryParam.safeParse("yes");
    expect(result.success).toBe(false);
  });

  it("rejects '1'", () => {
    const result = booleanQueryParam.safeParse("1");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = booleanQueryParam.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects number", () => {
    const result = booleanQueryParam.safeParse(1);
    expect(result.success).toBe(false);
  });

  it("rejects 'True' (case-sensitive)", () => {
    const result = booleanQueryParam.safeParse("True");
    expect(result.success).toBe(false);
  });

  it("rejects 'FALSE' (case-sensitive)", () => {
    const result = booleanQueryParam.safeParse("FALSE");
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = booleanQueryParam.safeParse(null);
    expect(result.success).toBe(false);
  });
});

// ── optionalBooleanQueryParam ─────────────────────────────────────

describe("optionalBooleanQueryParam", () => {
  it("coerces 'true' to true", () => {
    const result = optionalBooleanQueryParam.safeParse("true");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(true);
    }
  });

  it("coerces 'false' to false", () => {
    const result = optionalBooleanQueryParam.safeParse("false");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(false);
    }
  });

  it("preserves undefined when omitted", () => {
    const result = optionalBooleanQueryParam.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeUndefined();
    }
  });

  it("rejects 'yes'", () => {
    const result = optionalBooleanQueryParam.safeParse("yes");
    expect(result.success).toBe(false);
  });

  it("rejects '1'", () => {
    const result = optionalBooleanQueryParam.safeParse("1");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = optionalBooleanQueryParam.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects number", () => {
    const result = optionalBooleanQueryParam.safeParse(1);
    expect(result.success).toBe(false);
  });

  it("rejects 'True' (case-sensitive)", () => {
    const result = optionalBooleanQueryParam.safeParse("True");
    expect(result.success).toBe(false);
  });

  it("rejects 'FALSE' (case-sensitive)", () => {
    const result = optionalBooleanQueryParam.safeParse("FALSE");
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = optionalBooleanQueryParam.safeParse(null);
    expect(result.success).toBe(false);
  });
});

// ── LifecycleEventQuerySchema ────────────────────────────────────

describe("LifecycleEventQuerySchema", () => {
  it("accepts valid eventType", () => {
    const result = LifecycleEventQuerySchema.safeParse({ eventType: "discovery" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBe("discovery");
    }
  });

  it("accepts all valid event types", () => {
    const types = [
      "split",
      "fusion",
      "merge",
      "unmerge",
      "dormancy-start",
      "dormancy-end",
      "discovery",
      "archival",
      "structure-entity-formation",
      "form-change",
      "name-change",
      "structure-move",
      "innerworld-move",
    ];
    for (const t of types) {
      const result = LifecycleEventQuerySchema.safeParse({ eventType: t });
      expect(result.success).toBe(true);
    }
  });

  it("accepts omitted eventType", () => {
    const result = LifecycleEventQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBeUndefined();
    }
  });

  it("accepts undefined eventType", () => {
    const result = LifecycleEventQuerySchema.safeParse({ eventType: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventType).toBeUndefined();
    }
  });

  it("rejects invalid eventType", () => {
    const result = LifecycleEventQuerySchema.safeParse({ eventType: "invalid-type" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string eventType", () => {
    const result = LifecycleEventQuerySchema.safeParse({ eventType: "" });
    expect(result.success).toBe(false);
  });
});

// ── RelationshipQuerySchema ──────────────────────────────────────

describe("RelationshipQuerySchema", () => {
  const VALID_MEMBER_ID = "mem_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid memberId", () => {
    const result = RelationshipQuerySchema.safeParse({ memberId: VALID_MEMBER_ID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBe(VALID_MEMBER_ID);
    }
  });

  it("accepts omitted memberId", () => {
    const result = RelationshipQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memberId).toBeUndefined();
    }
  });

  it("accepts undefined memberId", () => {
    const result = RelationshipQuerySchema.safeParse({ memberId: undefined });
    expect(result.success).toBe(true);
  });

  it("rejects memberId with wrong prefix", () => {
    const result = RelationshipQuerySchema.safeParse({
      memberId: "sys_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects memberId with malformed UUID", () => {
    const result = RelationshipQuerySchema.safeParse({ memberId: "mem_not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects memberId as plain string", () => {
    const result = RelationshipQuerySchema.safeParse({ memberId: "random-string" });
    expect(result.success).toBe(false);
  });

  it("rejects 'null' string value for memberId", () => {
    const result = RelationshipQuerySchema.safeParse({ memberId: "null" });
    expect(result.success).toBe(false);
  });
});

// ── InnerWorldEntityQuerySchema ──────────────────────────────────

describe("InnerWorldEntityQuerySchema", () => {
  const VALID_REGION_ID = "iwr_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid regionId with includeArchived", () => {
    const result = InnerWorldEntityQuerySchema.safeParse({
      regionId: VALID_REGION_ID,
      includeArchived: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.regionId).toBe(VALID_REGION_ID);
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("accepts omitted regionId", () => {
    const result = InnerWorldEntityQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.regionId).toBeUndefined();
      expect(result.data.includeArchived).toBe(false);
    }
  });

  it("rejects regionId with wrong prefix", () => {
    const result = InnerWorldEntityQuerySchema.safeParse({
      regionId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects regionId with malformed UUID", () => {
    const result = InnerWorldEntityQuerySchema.safeParse({ regionId: "iwr_bad" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid includeArchived value", () => {
    const result = InnerWorldEntityQuerySchema.safeParse({ includeArchived: "yes" });
    expect(result.success).toBe(false);
  });
});

// ── StructureEntityLinkQuerySchema ──────────────────────────────

describe("StructureEntityLinkQuerySchema", () => {
  const VALID_ENTITY_ID = "ste_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid sourceEntityId and targetEntityId", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({
      sourceEntityId: VALID_ENTITY_ID,
      targetEntityId: VALID_ENTITY_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceEntityId).toBe(VALID_ENTITY_ID);
      expect(result.data.targetEntityId).toBe(VALID_ENTITY_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceEntityId).toBeUndefined();
      expect(result.data.targetEntityId).toBeUndefined();
    }
  });

  it("rejects sourceEntityId with wrong prefix", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({
      sourceEntityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects targetEntityId with wrong prefix", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({
      targetEntityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sourceEntityId with malformed UUID", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({ sourceEntityId: "ste_bad" });
    expect(result.success).toBe(false);
  });

  it("rejects targetEntityId with malformed UUID", () => {
    const result = StructureEntityLinkQuerySchema.safeParse({ targetEntityId: "ste_bad" });
    expect(result.success).toBe(false);
  });
});

// ── StructureEntityMemberLinkQuerySchema ────────────────────────

describe("StructureEntityMemberLinkQuerySchema", () => {
  const VALID_ENTITY_ID = "ste_550e8400-e29b-41d4-a716-446655440000";
  const VALID_MEMBER_ID = "mem_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid structureEntityId and memberId", () => {
    const result = StructureEntityMemberLinkQuerySchema.safeParse({
      structureEntityId: VALID_ENTITY_ID,
      memberId: VALID_MEMBER_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.structureEntityId).toBe(VALID_ENTITY_ID);
      expect(result.data.memberId).toBe(VALID_MEMBER_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = StructureEntityMemberLinkQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.structureEntityId).toBeUndefined();
      expect(result.data.memberId).toBeUndefined();
    }
  });

  it("rejects structureEntityId with wrong prefix", () => {
    const result = StructureEntityMemberLinkQuerySchema.safeParse({
      structureEntityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects memberId with wrong prefix", () => {
    const result = StructureEntityMemberLinkQuerySchema.safeParse({
      memberId: "sys_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});

// ── StructureEntityAssociationQuerySchema ────────────────────────

describe("StructureEntityAssociationQuerySchema", () => {
  const VALID_ENTITY_ID = "ste_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid sourceEntityId and targetEntityId", () => {
    const result = StructureEntityAssociationQuerySchema.safeParse({
      sourceEntityId: VALID_ENTITY_ID,
      targetEntityId: VALID_ENTITY_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceEntityId).toBe(VALID_ENTITY_ID);
      expect(result.data.targetEntityId).toBe(VALID_ENTITY_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = StructureEntityAssociationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceEntityId).toBeUndefined();
      expect(result.data.targetEntityId).toBeUndefined();
    }
  });

  it("rejects sourceEntityId with wrong prefix", () => {
    const result = StructureEntityAssociationQuerySchema.safeParse({
      sourceEntityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects targetEntityId with wrong prefix", () => {
    const result = StructureEntityAssociationQuerySchema.safeParse({
      targetEntityId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});

// ── IncludeArchivedQuerySchema ───────────────────────────────────

describe("IncludeArchivedQuerySchema", () => {
  it("coerces 'true' to true", () => {
    const result = IncludeArchivedQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("coerces 'false' to false", () => {
    const result = IncludeArchivedQuerySchema.safeParse({ includeArchived: "false" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });

  it("defaults to false when omitted", () => {
    const result = IncludeArchivedQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });

  it("rejects invalid values", () => {
    const result = IncludeArchivedQuerySchema.safeParse({ includeArchived: "maybe" });
    expect(result.success).toBe(false);
  });
});
