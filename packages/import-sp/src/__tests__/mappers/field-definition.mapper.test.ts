import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFieldDefinition } from "../../mappers/field-definition.mapper.js";

import type { SPCustomField } from "../../sources/sp-types.js";

describe("mapFieldDefinition", () => {
  it("maps a text field with explicit order", () => {
    const sp: SPCustomField = { _id: "f1", name: "Likes", type: "text", order: 0 };
    const result = mapFieldDefinition(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.name).toBe("Likes");
      expect(result.payload.fieldType).toBe("text");
      expect(result.payload.order).toBe(0);
      expect(result.payload.supportMarkdown).toBe(false);
    }
  });

  it("preserves supportMarkdown when set", () => {
    const sp: SPCustomField = {
      _id: "f2",
      name: "Bio",
      type: "text",
      order: 3,
      supportMarkdown: true,
    };
    const result = mapFieldDefinition(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.supportMarkdown).toBe(true);
    }
  });

  it("maps number, date, color, and url SP types to their FIELD_TYPES equivalents", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    for (const type of ["number", "date", "color", "url"] as const) {
      const sp: SPCustomField = { _id: `f_${type}`, name: type, type, order: 0 };
      const result = mapFieldDefinition(sp, ctx);
      expect(result.status).toBe("mapped");
      if (result.status === "mapped") {
        expect(result.payload.fieldType).toBe(type);
      }
    }
    expect(ctx.warnings).toHaveLength(0);
  });

  it("falls back to text for unknown SP types and emits a warning", () => {
    const sp: SPCustomField = { _id: "f3", name: "X", type: "weirdtype", order: 1 };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.fieldType).toBe("text");
    }
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("field-definition");
    expect(ctx.warnings[0]?.entityId).toBe("f3");
  });
});
