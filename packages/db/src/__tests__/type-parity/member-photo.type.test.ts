/**
 * Drizzle parity check: the MemberPhoto row shape inferred from the
 * `memberPhotos` table structurally matches `MemberPhotoServerMetadata`
 * in @pluralscape/types.
 *
 * `MemberPhotoServerMetadata` strips the encrypted field keys from the
 * domain (`imageSource`, `caption` ride inside `encryptedData`; the
 * domain marks `sortOrder` encrypted but the DB keeps it plaintext for
 * index-based ordering, so we add it back) and adds the DB-only columns
 * the domain type doesn't carry: `systemId` (denormalized from `members`
 * for RLS), full `AuditMetadata` (the domain interface lacks it), the
 * `EncryptedBlob` itself, and archivable metadata. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { memberPhotos } from "../../schema/pg/members.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, MemberPhotoServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("MemberPhoto Drizzle parity", () => {
  it("member_photos Drizzle row has the same property keys as MemberPhotoServerMetadata", () => {
    type Row = InferSelectModel<typeof memberPhotos>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof MemberPhotoServerMetadata>();
  });

  it("member_photos Drizzle row equals MemberPhotoServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof memberPhotos>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<MemberPhotoServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
