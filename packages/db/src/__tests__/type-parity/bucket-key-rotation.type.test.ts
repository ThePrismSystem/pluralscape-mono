/**
 * Drizzle parity check: the BucketKeyRotation row shape inferred from the
 * `bucket_key_rotations` table structurally matches
 * `BucketKeyRotationServerMetadata` in @pluralscape/types.
 *
 * Plaintext entity — the server row mirrors the domain type plus the
 * owning `systemId` column (cascade FK). See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { bucketKeyRotations } from "../../schema/pg/key-rotation.js";

import type { BucketKeyRotationServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("BucketKeyRotation Drizzle parity", () => {
  it("bucket_key_rotations Drizzle row has the same property keys as BucketKeyRotationServerMetadata", () => {
    type Row = InferSelectModel<typeof bucketKeyRotations>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof BucketKeyRotationServerMetadata>();
  });

  it("bucket_key_rotations Drizzle row equals BucketKeyRotationServerMetadata", () => {
    type Row = InferSelectModel<typeof bucketKeyRotations>;
    expectTypeOf<Equal<Row, BucketKeyRotationServerMetadata>>().toEqualTypeOf<true>();
  });
});
