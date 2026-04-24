/**
 * Drizzle parity check: the FriendCode row shape inferred from the
 * `friend_codes` table structurally matches `FriendCodeServerMetadata` in
 * @pluralscape/types.
 *
 * Plaintext entity — relaxes the domain's `archived: false` literal to
 * the raw boolean column and adds the nullable `archivedAt` that the
 * archivable-consistency check requires. See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { friendCodes } from "../../schema/pg/privacy.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, FriendCodeServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FriendCode Drizzle parity", () => {
  it("friend_codes Drizzle row has the same property keys as FriendCodeServerMetadata", () => {
    type Row = InferSelectModel<typeof friendCodes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FriendCodeServerMetadata>();
  });

  it("friend_codes Drizzle row equals FriendCodeServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof friendCodes>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<FriendCodeServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
