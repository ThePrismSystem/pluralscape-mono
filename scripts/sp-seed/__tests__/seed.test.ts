import { describe, expect, test, vi } from "vitest";
import { resolveRefs, triggerExportWith429Handling } from "../seed.js";
import { UnresolvedRefError, SpApiError } from "../client.js";

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

  test("recognizes refs with hyphens in the entity-type prefix", () => {
    const map = new Map<string, string>([
      ["front-history.alice-ended", "507f1f77bcf86cd799439011"],
    ]);
    const resolved = resolveRefs(
      { documentId: "front-history.alice-ended", collection: "frontHistory" },
      map,
    );
    expect(resolved).toEqual({
      documentId: "507f1f77bcf86cd799439011",
      collection: "frontHistory",
    });
  });
});

describe("triggerExportWith429Handling", () => {
  test("resolves normally when the call succeeds", async () => {
    const client = {
      request: vi.fn(async () => ({})),
    };
    await expect(triggerExportWith429Handling(client, "sys1")).resolves.toBeUndefined();
    expect(client.request).toHaveBeenCalledWith("/v1/user/sys1/export", {
      method: "POST",
      body: {},
    });
  });

  test("swallows SpApiError with status 429", async () => {
    const client = {
      request: vi.fn(async () => {
        throw new SpApiError(429, "POST", "/v1/user/sys1/export", "wait 3 min");
      }),
    };
    await expect(triggerExportWith429Handling(client, "sys1")).resolves.toBeUndefined();
  });

  test("rethrows SpApiError with non-429 status", async () => {
    const client = {
      request: vi.fn(async () => {
        throw new SpApiError(500, "POST", "/v1/user/sys1/export", "oops");
      }),
    };
    await expect(triggerExportWith429Handling(client, "sys1")).rejects.toMatchObject({
      status: 500,
    });
  });
});
