import { describe, expect, it } from "vitest";

import { entityKeys } from "../schemas/schema-utils.js";

import type { MemberId } from "@pluralscape/types";

describe("entityKeys", () => {
  it("returns keys preserving the branded type", () => {
    const record: Record<MemberId, { name: string }> = {} as Record<MemberId, { name: string }>;
     
    (record as Record<string, { name: string }>)["mem_1"] = { name: "Alice" };
     
    (record as Record<string, { name: string }>)["mem_2"] = { name: "Bob" };

    const keys = entityKeys(record);
    expect(keys).toHaveLength(2);
    expect(keys).toContain("mem_1");
    expect(keys).toContain("mem_2");
  });

  it("returns empty array for empty record", () => {
    const record: Record<MemberId, unknown> = {} as Record<MemberId, unknown>;
    expect(entityKeys(record)).toHaveLength(0);
  });
});
