/**
 * Type-level tests for the ServerInternal<T> marker. Verifies the brand
 * is structurally one-way assignable (T → ServerInternal<T> at the brand
 * boundary, but not the reverse). Also covers the EncryptedBase64 brand
 * for ciphertext on the wire.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { EncryptedBase64, Equal, ServerInternal } from "../index.js";

describe("ServerInternal<T>", () => {
  it("brands T with a phantom marker (not structurally equal to T)", () => {
    type Branded = ServerInternal<number>;
    expectTypeOf<Equal<Branded, number>>().toEqualTypeOf<false>();
  });

  it("brand value is assignable back to the underlying primitive", () => {
    type Branded = ServerInternal<string>;
    type IsAssignableToString = Branded extends string ? true : false;
    expectTypeOf<IsAssignableToString>().toEqualTypeOf<true>();
  });

  it("plain T is not assignable to ServerInternal<T>", () => {
    type IsAssignableFromString = string extends ServerInternal<string> ? true : false;
    expectTypeOf<IsAssignableFromString>().toEqualTypeOf<false>();
  });
});

describe("EncryptedBase64", () => {
  it("brands string with a phantom marker (not structurally equal to string)", () => {
    expectTypeOf<Equal<EncryptedBase64, string>>().toEqualTypeOf<false>();
  });

  it("is assignable back to string", () => {
    type IsAssignableToString = EncryptedBase64 extends string ? true : false;
    expectTypeOf<IsAssignableToString>().toEqualTypeOf<true>();
  });
});
