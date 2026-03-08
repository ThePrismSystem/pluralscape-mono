import { assertType, describe, expectTypeOf, it } from "vitest";

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
