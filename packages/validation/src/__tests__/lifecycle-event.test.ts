import { describe, expect, it } from "vitest";

import { CreateLifecycleEventBodySchema, validateLifecycleMetadata } from "../lifecycle-event.js";

describe("CreateLifecycleEventBodySchema", () => {
  it("accepts valid body without metadata", () => {
    const result = CreateLifecycleEventBodySchema.safeParse({
      eventType: "discovery",
      occurredAt: 1000,
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid body with metadata", () => {
    const result = CreateLifecycleEventBodySchema.safeParse({
      eventType: "discovery",
      occurredAt: 1000,
      encryptedData: "dGVzdA==",
      plaintextMetadata: { memberIds: ["mem_abc"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid eventType", () => {
    const result = CreateLifecycleEventBodySchema.safeParse({
      eventType: "invalid-type",
      occurredAt: 1000,
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateLifecycleMetadata", () => {
  it("validates discovery metadata (single memberIds)", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: ["mem_abc"] });
    expect(result.success).toBe(true);
  });

  it("rejects discovery metadata with multiple memberIds", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(false);
  });

  it("validates split metadata (2+ memberIds)", () => {
    const result = validateLifecycleMetadata("split", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("rejects split metadata with single memberIds", () => {
    const result = validateLifecycleMetadata("split", { memberIds: ["mem_a"] });
    expect(result.success).toBe(false);
  });

  it("validates merge metadata (exactly 2 memberIds)", () => {
    const result = validateLifecycleMetadata("merge", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("validates subsystem-formation metadata", () => {
    const result = validateLifecycleMetadata("subsystem-formation", {
      structureIds: ["sub_abc"],
    });
    expect(result.success).toBe(true);
  });

  it("validates structure-move metadata", () => {
    const result = validateLifecycleMetadata("structure-move", {
      memberIds: ["mem_a"],
      structureIds: ["sub_from", "sub_to"],
    });
    expect(result.success).toBe(true);
  });

  it("validates innerworld-move metadata", () => {
    const result = validateLifecycleMetadata("innerworld-move", {
      entityIds: ["iwe_abc"],
      regionIds: ["iwr_from", "iwr_to"],
    });
    expect(result.success).toBe(true);
  });

  it("validates dormancy-start metadata (single member)", () => {
    const result = validateLifecycleMetadata("dormancy-start", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  it("rejects empty memberIds for discovery", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: [] });
    expect(result.success).toBe(false);
  });
});
