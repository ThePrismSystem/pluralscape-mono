/**
 * Drizzle parity check: the PrivacyBucket row shape inferred from the
 * `buckets` table structurally matches `PrivacyBucketServerMetadata` in
 * @pluralscape/types.
 *
 * `PrivacyBucketServerMetadata` strips the domain's encrypted fields
 * (`name`, `description` — bundled inside `encryptedData`) and relaxes
 * `archived` from the domain's `false` literal to the raw boolean column.
 * See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { buckets } from "../../schema/pg/privacy.js";

import type { Equal, PrivacyBucketServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("PrivacyBucket Drizzle parity", () => {
  it("buckets Drizzle row has the same property keys as PrivacyBucketServerMetadata", () => {
    type Row = InferSelectModel<typeof buckets>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof PrivacyBucketServerMetadata>();
  });

  it("buckets Drizzle row equals PrivacyBucketServerMetadata", () => {
    type Row = InferSelectModel<typeof buckets>;
    expectTypeOf<Equal<Row, PrivacyBucketServerMetadata>>().toEqualTypeOf<true>();
  });
});
