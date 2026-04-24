/**
 * Drizzle parity check: the BucketRotationItem row shape inferred from
 * the `bucket_rotation_items` table structurally matches
 * `BucketRotationItemServerMetadata` in @pluralscape/types.
 *
 * Plaintext entity — the server row mirrors the domain type plus the
 * owning `systemId` column (cascade FK). The polymorphic `entityId`
 * column stays as a plain string (domain contract). See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { bucketRotationItems } from "../../schema/pg/key-rotation.js";

import type { BucketRotationItemServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("BucketRotationItem Drizzle parity", () => {
  it("bucket_rotation_items Drizzle row has the same property keys as BucketRotationItemServerMetadata", () => {
    type Row = InferSelectModel<typeof bucketRotationItems>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof BucketRotationItemServerMetadata>();
  });

  it("bucket_rotation_items Drizzle row equals BucketRotationItemServerMetadata", () => {
    type Row = InferSelectModel<typeof bucketRotationItems>;
    expectTypeOf<Equal<Row, BucketRotationItemServerMetadata>>().toEqualTypeOf<true>();
  });
});
