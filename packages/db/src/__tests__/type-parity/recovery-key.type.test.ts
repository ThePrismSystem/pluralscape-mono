/**
 * Drizzle parity check: the RecoveryKey row shape inferred from the
 * `recovery_keys` table structurally matches `RecoveryKeyServerMetadata`
 * in @pluralscape/types.
 *
 * RecoveryKey is plaintext: the DB row matches the domain type exactly
 * (the wrapped master key is stored as opaque bytes; the server only
 * verifies the recovery key hash to authorize the reset). See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { recoveryKeys } from "../../schema/pg/auth.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, RecoveryKeyServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("RecoveryKey Drizzle parity", () => {
  it("recovery_keys Drizzle row has the same property keys as RecoveryKeyServerMetadata", () => {
    type Row = InferSelectModel<typeof recoveryKeys>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof RecoveryKeyServerMetadata>();
  });

  it("recovery_keys Drizzle row equals RecoveryKeyServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof recoveryKeys>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<RecoveryKeyServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
