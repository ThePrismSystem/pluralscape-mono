import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFieldDefinition } from "../../mappers/field-definition.mapper.js";

import type { SPCustomField } from "../../sources/sp-types.js";

describe("mapFieldDefinition", () => {
  it("maps a text field (SP type=0) with a zero-order index", () => {
    const sp: SPCustomField = { _id: "f1", name: "Likes", type: 0, order: "0" };
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
      type: 0,
      order: "a00000",
      supportMarkdown: true,
    };
    const result = mapFieldDefinition(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.supportMarkdown).toBe(true);
    }
  });

  it("maps SP numeric type 1 (color) and 2-7 (date variants)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });

    const cases: readonly { readonly spType: number; readonly expected: string }[] = [
      { spType: 1, expected: "color" },
      { spType: 2, expected: "date" },
      { spType: 3, expected: "date" },
      { spType: 4, expected: "date" },
      { spType: 5, expected: "date" },
      { spType: 6, expected: "date" },
      { spType: 7, expected: "date" },
    ];

    for (const { spType, expected } of cases) {
      const sp: SPCustomField = {
        _id: `f_${String(spType)}`,
        name: `field-${String(spType)}`,
        type: spType,
        order: "0",
      };
      const result = mapFieldDefinition(sp, ctx);
      expect(result.status).toBe("mapped");
      if (result.status === "mapped") {
        expect(result.payload.fieldType).toBe(expected);
      }
    }
    expect(ctx.warnings).toHaveLength(0);
  });

  it("preserves relative ordering of fractional-index strings", () => {
    // Fractional indices sort lexicographically; the mapper's base-36 prefix
    // decode must produce integer orders that preserve that relationship
    // for the common single-character-differs case.
    const ctx = createMappingContext({ sourceMode: "fake" });
    const low = mapFieldDefinition({ _id: "fa", name: "A", type: 0, order: "a00000" }, ctx);
    const high = mapFieldDefinition({ _id: "fb", name: "B", type: 0, order: "b00000" }, ctx);
    if (low.status === "mapped" && high.status === "mapped") {
      expect(low.payload.order).toBeLessThan(high.payload.order);
    }
  });
});
