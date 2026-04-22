/**
 * Drizzle parity check: the Member row shape inferred from the `members`
 * table structurally matches `MemberServerMetadata` in @pluralscape/types.
 *
 * Drift between these two would let API services construct Member rows
 * that don't match what the database actually stores. The check is
 * compile-time (expectTypeOf on a type-level `Equal`), so failure appears
 * as a typecheck error; the describe/it wrapper gives a runtime-visible
 * test via the vitest project runner.
 *
 * What is checked:
 *   - Exact same property keys on both sides.
 *   - Same structural types after stripping ID/timestamp brands and
 *     `readonly` modifiers. Brands are intentionally not enforced at the
 *     Drizzle column level yet (the shared timestamps/versioned/archivable
 *     helpers return unbranded columns); lifting brands up to the helpers
 *     is tracked as follow-up work. Until then, brand-stripped equality
 *     still catches every real drift (new column, removed column, changed
 *     nullability, changed primitive type).
 */

import { describe, expectTypeOf, it } from "vitest";

import { members } from "../../schema/pg/members.js";

import type { Equal, MemberServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

/** Strip brand markers from primitives and recurse through objects/arrays. */
type StripBrands<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends bigint
        ? bigint
        : T extends Uint8Array
          ? Uint8Array
          : T extends Date
            ? Date
            : T extends ReadonlyArray<infer U>
              ? StripBrands<U>[]
              : T extends object
                ? { -readonly [K in keyof T]: StripBrands<T[K]> }
                : T;

describe("Member Drizzle parity", () => {
  it("members Drizzle row has the same property keys as MemberServerMetadata", () => {
    type Row = InferSelectModel<typeof members>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof MemberServerMetadata>();
  });

  it("members Drizzle row equals MemberServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof members>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<MemberServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
