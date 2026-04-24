/**
 * Drizzle parity check: the FriendConnection row shape inferred from
 * the `friend_connections` table structurally matches
 * `FriendConnectionServerMetadata` in @pluralscape/types.
 *
 * Hybrid entity — the domain carries derived fields (`assignedBucketIds`
 * from the `friend_bucket_assignments` junction table, `visibility` from
 * the decrypted `encryptedData` blob) that do not exist as row columns.
 * The server metadata strips those derived keys, relaxes `archived` to
 * the raw boolean column, and adds the nullable `encryptedData` blob
 * that carries the visibility payload. See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { friendConnections } from "../../schema/pg/privacy.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, FriendConnectionServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FriendConnection Drizzle parity", () => {
  it("friend_connections Drizzle row has the same property keys as FriendConnectionServerMetadata", () => {
    type Row = InferSelectModel<typeof friendConnections>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FriendConnectionServerMetadata>();
  });

  it("friend_connections Drizzle row equals FriendConnectionServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof friendConnections>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<FriendConnectionServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
