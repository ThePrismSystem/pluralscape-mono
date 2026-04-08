import { describe, expect, it } from "vitest";

import { entityEntries, entityKeys } from "../schema-utils.js";

describe("entityKeys", () => {
  it("returns an empty array for an empty record", () => {
    const result = entityKeys({} as Record<string, unknown>);
    expect(result).toEqual([]);
  });

  it("returns all keys of a non-empty record", () => {
    const record = { a: 1, b: 2, c: 3 } as Record<string, number>;
    const result = entityKeys(record);
    expect(result.sort()).toEqual(["a", "b", "c"]);
  });

  it("preserves branded key type (type-level: compiles without cast)", () => {
    type MemberId = string & { __brand: "MemberId" };
    const record = {
      m_1: { name: "Alice" },
      m_2: { name: "Bob" },
    } as Record<MemberId, { name: string }>;
    const keys: MemberId[] = entityKeys(record);
    expect(keys).toHaveLength(2);
  });
});

describe("entityEntries", () => {
  it("returns an empty array for an empty record", () => {
    const result = entityEntries({} as Record<string, number>);
    expect(result).toEqual([]);
  });

  it("returns all key-value pairs for a non-empty record", () => {
    const record = { x: 10, y: 20 } as Record<string, number>;
    const result = entityEntries(record);
    expect(result.sort(([a], [b]) => a.localeCompare(b))).toEqual([
      ["x", 10],
      ["y", 20],
    ]);
  });

  it("preserves branded key type on entries (type-level: compiles without cast)", () => {
    type GroupId = string & { __brand: "GroupId" };
    const record = {
      g_1: "Group A",
    } as Record<GroupId, string>;
    const entries: [GroupId, string][] = entityEntries(record);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(["g_1", "Group A"]);
  });
});
