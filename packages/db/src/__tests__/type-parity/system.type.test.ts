/**
 * Drizzle parity check: the System row shape inferred from the `systems`
 * table structurally matches `SystemServerMetadata` in @pluralscape/types.
 *
 * `SystemServerMetadata` strips the domain's encrypted fields (they live
 * inside `encryptedData`) and `settingsId` (joined from the companion
 * `system_settings` table), then adds the DB-only columns: `accountId`,
 * nullable `encryptedData`, and archivable metadata. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systems } from "../../schema/pg/systems.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SystemServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("System Drizzle parity", () => {
  it("systems Drizzle row has the same property keys as SystemServerMetadata", () => {
    type Row = InferSelectModel<typeof systems>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemServerMetadata>();
  });

  it("systems Drizzle row equals SystemServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof systems>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SystemServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
