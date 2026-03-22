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
  // ── discovery (single member) ──────────────────────────────────
  it("validates discovery metadata (single memberIds)", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: ["mem_abc"] });
    expect(result.success).toBe(true);
  });

  it("rejects discovery metadata with multiple memberIds", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(false);
  });

  it("rejects empty memberIds for discovery", () => {
    const result = validateLifecycleMetadata("discovery", { memberIds: [] });
    expect(result.success).toBe(false);
  });

  // ── split (2+ members) ────────────────────────────────────────
  it("validates split metadata (2+ memberIds)", () => {
    const result = validateLifecycleMetadata("split", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("rejects split metadata with single memberIds", () => {
    const result = validateLifecycleMetadata("split", { memberIds: ["mem_a"] });
    expect(result.success).toBe(false);
  });

  // ── fusion (2+ members, same schema as split) ─────────────────
  it("validates fusion metadata (2+ memberIds)", () => {
    const result = validateLifecycleMetadata("fusion", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("rejects fusion metadata with single memberIds", () => {
    const result = validateLifecycleMetadata("fusion", { memberIds: ["mem_a"] });
    expect(result.success).toBe(false);
  });

  // ── merge (exactly 2 members) ─────────────────────────────────
  it("validates merge metadata (exactly 2 memberIds)", () => {
    const result = validateLifecycleMetadata("merge", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("rejects merge metadata with 3+ memberIds", () => {
    const result = validateLifecycleMetadata("merge", {
      memberIds: ["mem_a", "mem_b", "mem_c"],
    });
    expect(result.success).toBe(false);
  });

  // ── unmerge (2+ members) ──────────────────────────────────────
  it("validates unmerge metadata (2+ memberIds)", () => {
    const result = validateLifecycleMetadata("unmerge", { memberIds: ["mem_a", "mem_b"] });
    expect(result.success).toBe(true);
  });

  it("rejects unmerge metadata with single memberIds", () => {
    const result = validateLifecycleMetadata("unmerge", { memberIds: ["mem_a"] });
    expect(result.success).toBe(false);
  });

  // ── dormancy-start / dormancy-end / archival / form-change / name-change (single member) ──
  it("validates dormancy-start metadata (single member)", () => {
    const result = validateLifecycleMetadata("dormancy-start", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  it("validates dormancy-end metadata (single member)", () => {
    const result = validateLifecycleMetadata("dormancy-end", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  it("validates archival metadata (single member)", () => {
    const result = validateLifecycleMetadata("archival", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  it("validates form-change metadata (single member)", () => {
    const result = validateLifecycleMetadata("form-change", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  it("validates name-change metadata (single member)", () => {
    const result = validateLifecycleMetadata("name-change", { memberIds: ["mem_a"] });
    expect(result.success).toBe(true);
  });

  // ── subsystem-formation ───────────────────────────────────────
  it("validates subsystem-formation metadata", () => {
    const result = validateLifecycleMetadata("subsystem-formation", {
      structureIds: ["ste_abc"],
    });
    expect(result.success).toBe(true);
  });

  // ── structure-move ────────────────────────────────────────────
  it("validates structure-move metadata", () => {
    const result = validateLifecycleMetadata("structure-move", {
      memberIds: ["mem_a"],
      structureIds: ["ste_from", "ste_to"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects structure-move with wrong structureIds count", () => {
    const result = validateLifecycleMetadata("structure-move", {
      memberIds: ["mem_a"],
      structureIds: ["ste_from"],
    });
    expect(result.success).toBe(false);
  });

  // ── innerworld-move ───────────────────────────────────────────
  it("validates innerworld-move metadata", () => {
    const result = validateLifecycleMetadata("innerworld-move", {
      entityIds: ["iwe_abc"],
      regionIds: ["iwr_from", "iwr_to"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects innerworld-move with empty regionIds", () => {
    const result = validateLifecycleMetadata("innerworld-move", {
      entityIds: ["iwe_abc"],
      regionIds: [],
    });
    expect(result.success).toBe(false);
  });
});
