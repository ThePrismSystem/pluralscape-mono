/**
 * Zod parity check for the LifecycleEvent discriminated union.
 *
 * `LifecycleEvent` is a discriminated union on `eventType` — a plain
 * `Pick<Union, K>` would only accept keys present on every variant, so
 * the domain projection uses a `DistributivePick` helper (the same
 * pattern the OpenAPI parity gate uses). The Zod schema is a `z.union(...)`
 * (not `z.discriminatedUnion` — the `eventType` discriminator is plaintext
 * on the wire, not inside the encrypted blob). Its inferred type is the
 * union of each variant's picked shape, which equals the distributive pick.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { LifecycleEventEncryptedInputSchema } from "../../lifecycle-event.js";
import type { Equal, LifecycleEvent, LifecycleEventEncryptedFields } from "@pluralscape/types";
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

describe("LifecycleEvent Zod parity", () => {
  it("LifecycleEventEncryptedInputSchema matches DistributivePick<LifecycleEvent, LifecycleEventEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof LifecycleEventEncryptedInputSchema>,
        DistributivePick<LifecycleEvent, LifecycleEventEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
