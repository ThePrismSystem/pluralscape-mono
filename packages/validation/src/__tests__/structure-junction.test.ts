import { describe, expect, it } from "vitest";

import { UpdateStructureEntityLinkBodySchema } from "../structure-junction.js";

describe("UpdateStructureEntityLinkBodySchema", () => {
  it("accepts valid sortOrder", () => {
    const result = UpdateStructureEntityLinkBodySchema.safeParse({ sortOrder: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts positive sortOrder", () => {
    const result = UpdateStructureEntityLinkBodySchema.safeParse({ sortOrder: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects negative sortOrder", () => {
    const result = UpdateStructureEntityLinkBodySchema.safeParse({ sortOrder: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sortOrder", () => {
    const result = UpdateStructureEntityLinkBodySchema.safeParse({ sortOrder: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing sortOrder", () => {
    const result = UpdateStructureEntityLinkBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
