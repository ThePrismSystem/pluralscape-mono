import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFieldDefinition } from "../../mappers/field-definition.mapper.js";

import type { SPCustomField, SPCustomFieldType } from "../../sources/sp-types.js";

describe("mapFieldDefinition", () => {
  it("maps a text field (SP type=0) with a zero-order index", () => {
    const sp: SPCustomField = { _id: "f1", name: "Likes", type: 0, order: "0" };
    const result = mapFieldDefinition(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.name).toBe("Likes");
      expect(result.payload.encrypted.description).toBeNull();
      expect(result.payload.encrypted.options).toBeNull();
      expect(result.payload.fieldType).toBe("text");
      expect(result.payload.sortOrder).toBe(0);
      expect(result.payload.required).toBe(false);
    }
  });

  it("maps SP numeric type 1 (color) and 2-7 (date variants)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });

    const cases: readonly { readonly spType: SPCustomFieldType; readonly expected: string }[] = [
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
      expect(low.payload.sortOrder).toBeLessThan(high.payload.sortOrder);
    }
  });

  it("numeric-string order is decoded base-10, not base-36", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPCustomField = { _id: "f1", name: "Age", type: 0, order: "42" };
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(42);
    }
  });

  it("fractional-index string is decoded base-36", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPCustomField = { _id: "f2", name: "Birthday", type: 2, order: "a00000" };
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(parseInt("a00000", 36));
    }
  });

  it("order '0' literal returns 0", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPCustomField = { _id: "f3", name: "Zero", type: 0, order: "0" };
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(0);
    }
  });

  it("rejects empty name with kind empty-name targeting name", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPCustomField = { _id: "f_empty", name: "", type: 0, order: "0" };
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("empty-name");
      expect(result.targetField).toBe("name");
    }
  });

  it("unparseable order emits a warning and returns 0", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPCustomField = { _id: "f4", name: "Bad", type: 0, order: "!!!" };
    const result = mapFieldDefinition(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.sortOrder).toBe(0);
    }
    const orderWarning = ctx.warnings.find((w) => /order/i.test(w.message) && w.entityId === "f4");
    expect(orderWarning?.entityId).toBe("f4");
  });
});
