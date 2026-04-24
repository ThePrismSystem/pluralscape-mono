/**
 * Drizzle parity check: the AuthKey row shape inferred from the
 * `auth_keys` table structurally matches `AuthKeyServerMetadata` in
 * @pluralscape/types.
 *
 * AuthKey is plaintext: the DB row matches the domain type exactly (the
 * encrypted private key is stored as opaque bytes wrapped under the
 * account KEK). See `member.type.test.ts` for the general rationale
 * behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { authKeys } from "../../schema/pg/auth.js";

import type { StripBrands } from "./__helpers__.js";
import type { AuthKeyServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("AuthKey Drizzle parity", () => {
  it("auth_keys Drizzle row has the same property keys as AuthKeyServerMetadata", () => {
    type Row = InferSelectModel<typeof authKeys>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof AuthKeyServerMetadata>();
  });

  it("auth_keys Drizzle row equals AuthKeyServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof authKeys>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<AuthKeyServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
