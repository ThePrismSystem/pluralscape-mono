/**
 * Drizzle parity check: the KeyGrant row shape inferred from the
 * `key_grants` table structurally matches `KeyGrantServerMetadata` in
 * @pluralscape/types.
 *
 * Plaintext entity — `encryptedBucketKey` is an E2E ciphertext the
 * server treats opaquely, not a client-encrypted domain field. The server
 * row renames the domain's `encryptedBucketKey` to `encryptedKey` and
 * adds the owning `systemId` FK. See `member.type.test.ts` for the
 * general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { keyGrants } from "../../schema/pg/privacy.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, KeyGrantServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("KeyGrant Drizzle parity", () => {
  it("key_grants Drizzle row has the same property keys as KeyGrantServerMetadata", () => {
    type Row = InferSelectModel<typeof keyGrants>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof KeyGrantServerMetadata>();
  });

  it("key_grants Drizzle row equals KeyGrantServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof keyGrants>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<KeyGrantServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
