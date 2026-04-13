import { describe, expect, it } from "vitest";

import { createMappingContext } from "../context.js";
import { MAX_WARNING_BUFFER_SIZE } from "../import-core.constants.js";

import type { MappingWarning } from "../context.js";

function makeWarning(overrides: Partial<MappingWarning> = {}): MappingWarning {
  return {
    entityType: "member",
    entityId: null,
    message: "test warning",
    ...overrides,
  };
}

describe("createMappingContext", () => {
  describe("translate()", () => {
    it("returns null for an unregistered entry", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      expect(ctx.translate("member", "src-1")).toBeNull();
    });

    it("returns the pluralscape ID for a registered entry", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.register("member", "src-1", "ps-1");
      expect(ctx.translate("member", "src-1")).toBe("ps-1");
    });

    it("isolates entries by entity type", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.register("member", "src-1", "ps-member");
      ctx.register("group", "src-1", "ps-group");
      expect(ctx.translate("member", "src-1")).toBe("ps-member");
      expect(ctx.translate("group", "src-1")).toBe("ps-group");
    });
  });

  describe("register()", () => {
    it("overwrites an existing entry with the same key", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.register("member", "src-1", "ps-old");
      ctx.register("member", "src-1", "ps-new");
      expect(ctx.translate("member", "src-1")).toBe("ps-new");
    });
  });

  describe("registerMany()", () => {
    it("populates the translation table with multiple entries", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.registerMany("member", [
        { sourceId: "a", pluralscapeId: "pa" },
        { sourceId: "b", pluralscapeId: "pb" },
      ]);
      expect(ctx.translate("member", "a")).toBe("pa");
      expect(ctx.translate("member", "b")).toBe("pb");
    });
  });

  describe("addWarning()", () => {
    it("appends a warning to the buffer", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.addWarning(makeWarning({ message: "w1" }));
      ctx.addWarning(makeWarning({ message: "w2" }));
      expect(ctx.warnings).toHaveLength(2);
      expect(ctx.warnings[0]?.message).toBe("w1");
      expect(ctx.warnings[1]?.message).toBe("w2");
    });

    it("respects the buffer limit and emits a truncation marker", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      // Fill up to MAX - 1 (the reserved slot)
      for (let i = 0; i < MAX_WARNING_BUFFER_SIZE; i++) {
        ctx.addWarning(makeWarning({ message: `w${String(i)}` }));
      }
      // Buffer should be exactly MAX_WARNING_BUFFER_SIZE: (MAX-1) regular + 1 truncation marker
      expect(ctx.warnings).toHaveLength(MAX_WARNING_BUFFER_SIZE);
      const lastWarning = ctx.warnings[ctx.warnings.length - 1];
      expect(lastWarning?.kind).toBe("warnings-truncated");

      // Further warnings are dropped
      ctx.addWarning(makeWarning({ message: "overflow" }));
      expect(ctx.warnings).toHaveLength(MAX_WARNING_BUFFER_SIZE);
    });
  });

  describe("addWarningOnce()", () => {
    it("deduplicates by key", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.addWarningOnce("dup-key", makeWarning({ message: "first" }));
      ctx.addWarningOnce("dup-key", makeWarning({ message: "second" }));
      expect(ctx.warnings).toHaveLength(1);
      expect(ctx.warnings[0]?.message).toBe("first");
    });

    it("allows different keys", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.addWarningOnce("key-a", makeWarning({ message: "a" }));
      ctx.addWarningOnce("key-b", makeWarning({ message: "b" }));
      expect(ctx.warnings).toHaveLength(2);
    });

    it("respects the buffer limit", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      for (let i = 0; i < MAX_WARNING_BUFFER_SIZE; i++) {
        ctx.addWarningOnce(`key-${String(i)}`, makeWarning({ message: `w${String(i)}` }));
      }
      expect(ctx.warnings).toHaveLength(MAX_WARNING_BUFFER_SIZE);
      const lastWarning = ctx.warnings[ctx.warnings.length - 1];
      expect(lastWarning?.kind).toBe("warnings-truncated");
    });
  });

  describe("storeMetadata() / getMetadata()", () => {
    it("round-trips a stored value", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.storeMetadata("member", "src-1", "color", "#ff0000");
      expect(ctx.getMetadata("member", "src-1", "color")).toBe("#ff0000");
    });

    it("returns undefined for unset metadata", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      expect(ctx.getMetadata("member", "src-1", "missing")).toBeUndefined();
    });

    it("isolates metadata by entityType, sourceId, and key", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      ctx.storeMetadata("member", "src-1", "key", "val-member");
      ctx.storeMetadata("group", "src-1", "key", "val-group");
      ctx.storeMetadata("member", "src-2", "key", "val-src2");
      ctx.storeMetadata("member", "src-1", "other", "val-other");

      expect(ctx.getMetadata("member", "src-1", "key")).toBe("val-member");
      expect(ctx.getMetadata("group", "src-1", "key")).toBe("val-group");
      expect(ctx.getMetadata("member", "src-2", "key")).toBe("val-src2");
      expect(ctx.getMetadata("member", "src-1", "other")).toBe("val-other");
    });

    it("stores complex values", () => {
      const ctx = createMappingContext({ sourceMode: "fake" });
      const complex = { nested: [1, 2, 3], flag: true };
      ctx.storeMetadata("member", "src-1", "data", complex);
      expect(ctx.getMetadata("member", "src-1", "data")).toBe(complex);
    });
  });

  describe("sourceMode", () => {
    it("exposes the source mode passed at creation", () => {
      const ctx = createMappingContext({ sourceMode: "api" });
      expect(ctx.sourceMode).toBe("api");
    });
  });
});
