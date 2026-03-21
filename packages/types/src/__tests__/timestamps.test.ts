import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { toUnixMillis, toUnixMillisOrNull } from "../timestamps.js";

import type { ISOTimestamp, UnixMillis } from "../timestamps.js";

describe("UnixMillis", () => {
  it("is not assignable from plain number", () => {
    // @ts-expect-error plain number not assignable to branded UnixMillis
    assertType<UnixMillis>(1234567890);
  });

  it("is assignable to number", () => {
    expectTypeOf<UnixMillis>().toExtend<number>();
  });
});

describe("ISOTimestamp", () => {
  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded ISOTimestamp
    assertType<ISOTimestamp>("2024-01-01T00:00:00.000Z");
  });

  it("is assignable to string", () => {
    expectTypeOf<ISOTimestamp>().toExtend<string>();
  });
});

describe("toUnixMillis", () => {
  it("returns a branded UnixMillis from a number", () => {
    const result = toUnixMillis(1000);
    expect(result).toBe(1000);
    expectTypeOf(result).toEqualTypeOf<UnixMillis>();
  });

  it("accepts zero", () => {
    expect(toUnixMillis(0)).toBe(0);
  });

  it("accepts negative values", () => {
    expect(toUnixMillis(-1000)).toBe(-1000);
  });

  it("throws TypeError for NaN", () => {
    expect(() => toUnixMillis(NaN)).toThrow(TypeError);
  });

  it("throws TypeError for Infinity", () => {
    expect(() => toUnixMillis(Infinity)).toThrow(TypeError);
  });

  it("throws TypeError for -Infinity", () => {
    expect(() => toUnixMillis(-Infinity)).toThrow(TypeError);
  });
});

describe("toUnixMillisOrNull", () => {
  it("returns null for null input", () => {
    expect(toUnixMillisOrNull(null)).toBeNull();
  });

  it("returns branded UnixMillis for a number", () => {
    const result = toUnixMillisOrNull(1000);
    expect(result).toBe(1000);
  });

  it("throws TypeError for NaN", () => {
    expect(() => toUnixMillisOrNull(NaN)).toThrow(TypeError);
  });

  it("throws TypeError for Infinity", () => {
    expect(() => toUnixMillisOrNull(Infinity)).toThrow(TypeError);
  });
});

describe("cross-type non-interchangeability", () => {
  it("UnixMillis is not assignable to ISOTimestamp", () => {
    // @ts-expect-error UnixMillis not assignable to ISOTimestamp
    expectTypeOf<UnixMillis>().toEqualTypeOf<ISOTimestamp>();
  });

  it("ISOTimestamp is not assignable to UnixMillis", () => {
    // @ts-expect-error ISOTimestamp not assignable to UnixMillis
    expectTypeOf<ISOTimestamp>().toEqualTypeOf<UnixMillis>();
  });
});
