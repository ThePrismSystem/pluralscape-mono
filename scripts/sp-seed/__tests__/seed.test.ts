import { describe, expect, test } from "vitest";
import { resolveRefs } from "../seed.js";
import { UnresolvedRefError } from "../client.js";

describe("resolveRefs", () => {
  test("replaces top-level ref strings using the map", () => {
    const map = new Map<string, string>([["member.alice", "507f1f77bcf86cd799439011"]]);
    const resolved = resolveRefs({ member: "member.alice", live: true }, map);
    expect(resolved).toEqual({ member: "507f1f77bcf86cd799439011", live: true });
  });

  test("replaces refs in string arrays", () => {
    const map = new Map<string, string>([
      ["member.alice", "id-alice"],
      ["member.bob", "id-bob"],
    ]);
    const resolved = resolveRefs({ members: ["member.alice", "member.bob"] }, map);
    expect(resolved).toEqual({ members: ["id-alice", "id-bob"] });
  });

  test("leaves non-ref strings untouched", () => {
    const map = new Map<string, string>([["member.alice", "id-alice"]]);
    const resolved = resolveRefs({ name: "Alice", desc: "not.a.ref" }, map);
    expect(resolved).toEqual({ name: "Alice", desc: "not.a.ref" });
  });

  test("throws UnresolvedRefError on a ref missing from the map", () => {
    const map = new Map<string, string>();
    expect(() => resolveRefs({ member: "member.missing" }, map)).toThrow(UnresolvedRefError);
  });

  test("preserves numbers, booleans, and nested objects", () => {
    const map = new Map<string, string>([["member.alice", "id-alice"]]);
    const resolved = resolveRefs(
      {
        custom: false,
        startTime: 12345,
        member: "member.alice",
        options: [{ name: "Chips", color: "#ff0000" }],
      },
      map,
    );
    expect(resolved).toEqual({
      custom: false,
      startTime: 12345,
      member: "id-alice",
      options: [{ name: "Chips", color: "#ff0000" }],
    });
  });
});
