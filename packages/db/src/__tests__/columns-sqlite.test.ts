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

  it("throws on NaN in toDriver", () => {
    expect(() => timestampToDriver(NaN)).toThrow("not a finite number");
  });

  it("throws on Infinity in toDriver", () => {
    expect(() => timestampToDriver(Infinity)).toThrow("not a finite number");
  });

  it("throws on -Infinity in toDriver", () => {
    expect(() => timestampToDriver(-Infinity)).toThrow("not a finite number");
  });

  it("throws on NaN in fromDriver", () => {
    expect(() => timestampFromDriver(NaN)).toThrow("not a finite number");
  });

  it("throws on Infinity in fromDriver", () => {
    expect(() => timestampFromDriver(Infinity)).toThrow("not a finite number");
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

  it("throws with context on malformed JSON", () => {
    expect(() => jsonFromDriver("{invalid")).toThrow(
      'Failed to parse JSON from database: "{invalid"',
    );
  });

  it("throws on empty string", () => {
    expect(() => jsonFromDriver("")).toThrow("Failed to parse JSON from database");
  });
});
