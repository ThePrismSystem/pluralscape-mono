import { describe, expect, expectTypeOf, it } from "vitest";

import { createId, now, toISO } from "../runtime.js";
import { toUnixMillis } from "../timestamps.js";

import type { SystemId } from "../ids.js";
import type { ISOTimestamp, UnixMillis } from "../timestamps.js";

describe("createId", () => {
  it("produces a string with the given prefix followed by a UUID", () => {
    const id = createId("sys_");
    expect(id).toMatch(/^sys_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("produces unique IDs on successive calls", () => {
    const a = createId("sys_");
    const b = createId("sys_");
    expect(a).not.toBe(b);
  });

  it("supports different prefixes", () => {
    const memId = createId("mem_");
    expect(memId).toMatch(/^mem_/);
    const grpId = createId("grp_");
    expect(grpId).toMatch(/^grp_/);
  });

  it("returns a string that can be cast to a branded ID", () => {
    const id = createId("sys_") as SystemId;
    expectTypeOf(id).toEqualTypeOf<SystemId>();
  });

  it("throws on empty prefix", () => {
    expect(() => createId("")).toThrow("ID prefix must not be empty");
  });

  it("throws on prefix without trailing underscore", () => {
    expect(() => createId("sys")).toThrow("ID prefix must end with '_'");
  });
});

describe("now", () => {
  it("returns a number within 100ms of Date.now()", () => {
    const before = Date.now();
    const result = now();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns a branded UnixMillis", () => {
    expectTypeOf(now()).toEqualTypeOf<UnixMillis>();
  });
});

describe("toISO", () => {
  it("produces a valid ISO 8601 string", () => {
    const ms = toUnixMillis(1704067200000); // 2024-01-01T00:00:00.000Z
    const iso = toISO(ms);
    expect(iso).toBe("2024-01-01T00:00:00.000Z");
  });

  it("round-trips through Date.parse", () => {
    const ms = now();
    const iso = toISO(ms);
    expect(Date.parse(iso)).toBe(ms);
  });

  it("returns a branded ISOTimestamp", () => {
    const ms = toUnixMillis(0);
    expectTypeOf(toISO(ms)).toEqualTypeOf<ISOTimestamp>();
  });
});
