import { describe, expect, it } from "vitest";

import {
  jsonFromDriver,
  jsonToDriver,
  timestampFromDriver,
  timestampToDriver,
} from "../columns/sqlite.js";

describe("sqliteTimestamp mapping", () => {
  it("passes through integer values", () => {
    const ms = 1704067200000;
    expect(timestampToDriver(ms)).toBe(ms);
    expect(timestampFromDriver(ms)).toBe(ms);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const ms = Date.now();
    expect(timestampFromDriver(timestampToDriver(ms))).toBe(ms);
  });
});

describe("sqliteJson mapping", () => {
  it("converts object to JSON string", () => {
    const input = { name: "test" };
    expect(jsonToDriver(input)).toBe('{"name":"test"}');
  });

  it("parses JSON string to object", () => {
    expect(jsonFromDriver('{"name":"test"}')).toEqual({ name: "test" });
  });

  it("round-trips nested objects", () => {
    const input = { nested: { array: [1, 2, 3] } };
    expect(jsonFromDriver(jsonToDriver(input))).toEqual(input);
  });
});
