/**
 * Zod parity check for the InnerWorldEntity discriminated union.
 *
 * `InnerWorldEntity` is a discriminated union on `entityType` — a plain
 * `Pick<Union, K>` would only accept keys present on every variant, so
 * the domain projection uses a `DistributivePick` helper (the same
 * pattern the OpenAPI parity gate uses). The Zod schema is a
 * `z.discriminatedUnion(...)`; its inferred type is the union of each
 * variant's picked shape, which equals the distributive pick.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { InnerWorldEntityEncryptedInputSchema } from "../../innerworld.js";
import type { Equal, InnerWorldEntity, InnerWorldEntityEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

/**
 * Per-variant `Pick` applied across a union's members. Matches the helper
 * used in `scripts/openapi-wire-parity.type-test.ts` so the Zod, OpenAPI,
 * and domain projections all agree on how encrypted keys project into
 * each variant.
 */
type DistributivePick<T, K extends PropertyKey> = T extends unknown
  ? Pick<T, Extract<keyof T, K>>
  : never;

describe("InnerWorldEntity Zod parity", () => {
  it("InnerWorldEntityEncryptedInputSchema matches DistributivePick<InnerWorldEntity, InnerWorldEntityEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof InnerWorldEntityEncryptedInputSchema>,
        DistributivePick<InnerWorldEntity, InnerWorldEntityEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
