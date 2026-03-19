import { describe, expect, it } from "vitest";

import {
  booleanQueryParam,
  IncludeArchivedQuerySchema,
  InnerWorldEntityQuerySchema,
  LifecycleEventQuerySchema,
  RelationshipQuerySchema,
  SideSystemLayerQuerySchema,
  SubsystemLayerQuerySchema,
  SubsystemSideSystemQuerySchema,
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
      "subsystem-formation",
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

// ── SubsystemLayerQuerySchema ──────────────────────────────────

describe("SubsystemLayerQuerySchema", () => {
  const VALID_SUBSYSTEM_ID = "sub_550e8400-e29b-41d4-a716-446655440000";
  const VALID_LAYER_ID = "lyr_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid subsystemId and layerId", () => {
    const result = SubsystemLayerQuerySchema.safeParse({
      subsystemId: VALID_SUBSYSTEM_ID,
      layerId: VALID_LAYER_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subsystemId).toBe(VALID_SUBSYSTEM_ID);
      expect(result.data.layerId).toBe(VALID_LAYER_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = SubsystemLayerQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subsystemId).toBeUndefined();
      expect(result.data.layerId).toBeUndefined();
    }
  });

  it("rejects subsystemId with wrong prefix", () => {
    const result = SubsystemLayerQuerySchema.safeParse({
      subsystemId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects layerId with wrong prefix", () => {
    const result = SubsystemLayerQuerySchema.safeParse({
      layerId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subsystemId with malformed UUID", () => {
    const result = SubsystemLayerQuerySchema.safeParse({ subsystemId: "sub_bad" });
    expect(result.success).toBe(false);
  });

  it("rejects layerId with malformed UUID", () => {
    const result = SubsystemLayerQuerySchema.safeParse({ layerId: "lyr_bad" });
    expect(result.success).toBe(false);
  });
});

// ── SubsystemSideSystemQuerySchema ─────────────────────────────

describe("SubsystemSideSystemQuerySchema", () => {
  const VALID_SUBSYSTEM_ID = "sub_550e8400-e29b-41d4-a716-446655440000";
  const VALID_SIDE_SYSTEM_ID = "ss_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid subsystemId and sideSystemId", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({
      subsystemId: VALID_SUBSYSTEM_ID,
      sideSystemId: VALID_SIDE_SYSTEM_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subsystemId).toBe(VALID_SUBSYSTEM_ID);
      expect(result.data.sideSystemId).toBe(VALID_SIDE_SYSTEM_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subsystemId).toBeUndefined();
      expect(result.data.sideSystemId).toBeUndefined();
    }
  });

  it("rejects subsystemId with wrong prefix", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({
      subsystemId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sideSystemId with wrong prefix", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({
      sideSystemId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subsystemId with malformed UUID", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({ subsystemId: "sub_bad" });
    expect(result.success).toBe(false);
  });

  it("rejects sideSystemId with malformed UUID", () => {
    const result = SubsystemSideSystemQuerySchema.safeParse({ sideSystemId: "ss_bad" });
    expect(result.success).toBe(false);
  });
});

// ── SideSystemLayerQuerySchema ─────────────────────────────────

describe("SideSystemLayerQuerySchema", () => {
  const VALID_SIDE_SYSTEM_ID = "ss_550e8400-e29b-41d4-a716-446655440000";
  const VALID_LAYER_ID = "lyr_550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid sideSystemId and layerId", () => {
    const result = SideSystemLayerQuerySchema.safeParse({
      sideSystemId: VALID_SIDE_SYSTEM_ID,
      layerId: VALID_LAYER_ID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sideSystemId).toBe(VALID_SIDE_SYSTEM_ID);
      expect(result.data.layerId).toBe(VALID_LAYER_ID);
    }
  });

  it("accepts all fields omitted", () => {
    const result = SideSystemLayerQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sideSystemId).toBeUndefined();
      expect(result.data.layerId).toBeUndefined();
    }
  });

  it("rejects sideSystemId with wrong prefix", () => {
    const result = SideSystemLayerQuerySchema.safeParse({
      sideSystemId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects layerId with wrong prefix", () => {
    const result = SideSystemLayerQuerySchema.safeParse({
      layerId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sideSystemId with malformed UUID", () => {
    const result = SideSystemLayerQuerySchema.safeParse({ sideSystemId: "ss_bad" });
    expect(result.success).toBe(false);
  });

  it("rejects layerId with malformed UUID", () => {
    const result = SideSystemLayerQuerySchema.safeParse({ layerId: "lyr_bad" });
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
