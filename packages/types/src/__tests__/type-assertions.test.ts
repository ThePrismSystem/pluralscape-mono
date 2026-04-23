import { describe, expectTypeOf, it } from "vitest";

import type { MemberId } from "../ids.js";
import type { Assert, Equal, Serialize } from "../type-assertions.js";

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

describe("Serialize<T>", () => {
  it("converts Date to ISO string", () => {
    type Input = { createdAt: Date };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ createdAt: string }>();
  });

  it("converts Uint8Array to base64 string", () => {
    type Input = { encryptedData: Uint8Array };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ encryptedData: string }>();
  });

  it("strips branded IDs to plain string", () => {
    type Input = { id: MemberId };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ id: string }>();
  });

  it("recurses into nested objects", () => {
    type Input = { outer: { inner: Date } };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ outer: { inner: string } }>();
  });

  it("recurses into arrays", () => {
    type Input = { items: Date[] };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ items: string[] }>();
  });

  it("preserves primitives", () => {
    type Input = { a: string; b: number; c: boolean; d: null };
    expectTypeOf<Serialize<Input>>().toEqualTypeOf<Input>();
  });

  it("preserves optional markers", () => {
    type Input = { a?: Date };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ a?: string }>();
  });

  it("preserves union branches and serializes each", () => {
    type Input = { a: Date | null };
    type Output = Serialize<Input>;
    expectTypeOf<Output>().toEqualTypeOf<{ a: string | null }>();
  });

  it("strips branded strings declared via the canonical Brand<T, B> helper", () => {
    type Input = { pending: import("../entities/account.js").PendingAccountId };
    expectTypeOf<Serialize<Input>>().toEqualTypeOf<{ pending: string }>();
  });
});
