/**
 * Drizzle parity check: the CustomFront row shape inferred from the
 * `customFronts` table structurally matches `CustomFrontServerMetadata`
 * in @pluralscape/types.
 *
 * `CustomFrontServerMetadata` strips the encrypted field keys from the
 * domain (`name`, `description`, `color`, `emoji` ride inside
 * `encryptedData`) and `archived` (server tracks a mutable boolean
 * with a companion `archivedAt` timestamp, while the domain uses `false`
 * literal). Adds the DB-only columns: `encryptedData` (the T1 blob),
 * `archived`/`archivedAt`. `AuditMetadata` is already on the domain.
 * See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison. Note: the `customFronts` table declaration
 * lives in `schema/pg/fronting.ts`, not a dedicated custom-front file.
 */

import { describe, expectTypeOf, it } from "vitest";

import { customFronts } from "../../schema/pg/fronting.js";

import type { StripBrands } from "./__helpers__.js";
import type { CustomFrontServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("CustomFront Drizzle parity", () => {
  it("custom_fronts Drizzle row has the same property keys as CustomFrontServerMetadata", () => {
    type Row = InferSelectModel<typeof customFronts>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof CustomFrontServerMetadata>();
  });

  it("custom_fronts Drizzle row equals CustomFrontServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof customFronts>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<CustomFrontServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
