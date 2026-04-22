import { describe, expectTypeOf, it } from "vitest";

import type { Assert, Equal } from "../type-assertions.js";

describe("Equal<A, B>", () => {
  it("returns true for structurally identical types", () => {
    expectTypeOf<Equal<{ a: string }, { a: string }>>().toEqualTypeOf<true>();
    expectTypeOf<Equal<string, string>>().toEqualTypeOf<true>();
    expectTypeOf<Equal<number | string, string | number>>().toEqualTypeOf<true>();
  });

  it("returns false for structurally different types", () => {
    expectTypeOf<Equal<{ a: string }, { a: string; b: number }>>().toEqualTypeOf<false>();
    expectTypeOf<Equal<string, number>>().toEqualTypeOf<false>();
  });

  it("distinguishes optional from required", () => {
    expectTypeOf<Equal<{ a: string }, { a?: string }>>().toEqualTypeOf<false>();
  });

  it("distinguishes `T | undefined` from optional property", () => {
    expectTypeOf<Equal<{ a: string | undefined }, { a?: string }>>().toEqualTypeOf<false>();
  });

  it("distinguishes branded from unbranded", () => {
    type Brand<T, B> = T & { readonly __brand: B };
    expectTypeOf<Equal<Brand<string, "X">, string>>().toEqualTypeOf<false>();
    expectTypeOf<Equal<Brand<string, "X">, Brand<string, "Y">>>().toEqualTypeOf<false>();
  });
});

describe("Assert<T>", () => {
  it("accepts true", () => {
    expectTypeOf<Assert<true>>().toEqualTypeOf<true>();
  });

  it("rejects non-true at compile time via @ts-expect-error", () => {
    // @ts-expect-error — Assert rejects `false`
    type _BadFalse = Assert<false>;
    // @ts-expect-error — Assert rejects `boolean`
    type _BadBoolean = Assert<boolean>;
    expectTypeOf<[_BadFalse, _BadBoolean]>();
  });
});
