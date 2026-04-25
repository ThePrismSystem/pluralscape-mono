/**
 * Type-level tests for EncryptedWire<T>'s post-u87m/ecol behavior:
 * - Strips all top-level ServerInternal<…>-marked fields
 * - Brands encryptedData as EncryptedBase64 (or EncryptedBase64 | null,
 *   preserving nullability from T)
 * - Other fields pass through unchanged
 * - Serialize<T> strips ServerInternal markers (parity-test coherence)
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  EncryptedBase64,
  EncryptedBlob,
  EncryptedWire,
  Serialize,
  ServerInternal,
} from "../index.js";

describe("EncryptedWire<T>", () => {
  it("brands encryptedData as EncryptedBase64 (non-nullable variant)", () => {
    interface Sample {
      readonly id: string;
      readonly encryptedData: EncryptedBlob;
    }
    type Wire = EncryptedWire<Sample>;
    expectTypeOf<Wire["encryptedData"]>().toEqualTypeOf<EncryptedBase64>();
  });

  it("brands encryptedData as EncryptedBase64 | null when source is nullable", () => {
    interface Sample {
      readonly id: string;
      readonly encryptedData: EncryptedBlob | null;
    }
    type Wire = EncryptedWire<Sample>;
    expectTypeOf<Wire["encryptedData"]>().toEqualTypeOf<EncryptedBase64 | null>();
  });

  it("strips ServerInternal-marked fields", () => {
    interface Sample {
      readonly id: string;
      readonly encryptedData: EncryptedBlob;
      readonly internalNote: ServerInternal<string>;
    }
    type Wire = EncryptedWire<Sample>;
    type HasInternal = "internalNote" extends keyof Wire ? true : false;
    expectTypeOf<HasInternal>().toEqualTypeOf<false>();
  });

  it("passes through non-internal fields unchanged", () => {
    interface Sample {
      readonly id: string;
      readonly count: number;
      readonly encryptedData: EncryptedBlob;
    }
    type Wire = EncryptedWire<Sample>;
    expectTypeOf<Wire["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Wire["count"]>().toEqualTypeOf<number>();
  });
});

describe("Serialize<T> + ServerInternal", () => {
  it("strips entire fields whose value is ServerInternal<…>", () => {
    interface Sample {
      readonly id: string;
      readonly secret: ServerInternal<string>;
    }
    type Out = Serialize<Sample>;
    type HasSecret = "secret" extends keyof Out ? true : false;
    expectTypeOf<HasSecret>().toEqualTypeOf<false>();
    expectTypeOf<Out>().toEqualTypeOf<{ readonly id: string }>();
  });
});
