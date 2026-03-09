import { describe, expect, it } from "vitest";

import {
  binaryFromDriver,
  binaryToDriver,
  jsonFromDriver,
  jsonToDriver,
  timestampFromDriver,
  timestampToDriver,
} from "../columns/pg.js";

describe("pgTimestamp mapping", () => {
  it("converts UnixMillis to ISO string", () => {
    const ms = 1704067200000; // 2024-01-01T00:00:00.000Z
    expect(timestampToDriver(ms)).toBe("2024-01-01T00:00:00.000Z");
  });

  it("converts ISO string back to UnixMillis", () => {
    expect(timestampFromDriver("2024-01-01T00:00:00.000Z")).toBe(1704067200000);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const ms = Date.now();
    expect(timestampFromDriver(timestampToDriver(ms))).toBe(ms);
  });
});

describe("pgBinary mapping", () => {
  it("converts Uint8Array to Buffer", () => {
    const input = new Uint8Array([1, 2, 3]);
    const result = binaryToDriver(input);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it("converts Buffer back to Uint8Array", () => {
    const input = Buffer.from([1, 2, 3]);
    const result = binaryFromDriver(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect([...result]).toEqual([1, 2, 3]);
  });

  it("round-trips through toDriver/fromDriver", () => {
    const original = new Uint8Array([0, 127, 255]);
    const result = binaryFromDriver(binaryToDriver(original));
    expect([...result]).toEqual([...original]);
  });
});

describe("pgJsonb mapping", () => {
  it("converts object to JSON string", () => {
    const input = { name: "test", count: 42 };
    expect(jsonToDriver(input)).toBe('{"name":"test","count":42}');
  });

  it("parses JSON string to object", () => {
    const result = jsonFromDriver('{"name":"test","count":42}');
    expect(result).toEqual({ name: "test", count: 42 });
  });

  it("round-trips nested objects", () => {
    const input = { nested: { array: [1, 2, 3] } };
    expect(jsonFromDriver(jsonToDriver(input))).toEqual(input);
  });
});
