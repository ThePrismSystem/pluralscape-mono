/**
 * Drizzle parity check: the MemberPhoto row shape inferred from the
 * `member_photos` table structurally matches `MemberPhotoServerMetadata`
 * in @pluralscape/types.
 *
 * Server-side additions over the `MemberPhoto` domain:
 * - `encryptedData: EncryptedBlob` — the T1 blob holding `imageSource`
 *   and `caption` (the only encrypted fields on the domain).
 * - `archived: boolean` — widens the domain's `false` literal to match
 *   the DB column.
 *
 * `sortOrder` is plaintext on both sides: the domain carries it as a
 * top-level field (used by mobile sort UI), and the DB stores it as a
 * plain integer column for index-based ordering.
 *
 * See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { memberPhotos } from "../../schema/pg/members.js";

import type { Equal, MemberPhotoServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("MemberPhoto Drizzle parity", () => {
  it("member_photos Drizzle row has the same property keys as MemberPhotoServerMetadata", () => {
    type Row = InferSelectModel<typeof memberPhotos>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof MemberPhotoServerMetadata>();
  });

  it("member_photos Drizzle row equals MemberPhotoServerMetadata", () => {
    type Row = InferSelectModel<typeof memberPhotos>;
    expectTypeOf<Equal<Row, MemberPhotoServerMetadata>>().toEqualTypeOf<true>();
  });
});
