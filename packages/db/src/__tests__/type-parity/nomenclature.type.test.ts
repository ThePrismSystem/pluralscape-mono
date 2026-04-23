/**
 * Drizzle parity check: the Nomenclature row shape inferred from the
 * `nomenclature_settings` table structurally matches
 * `NomenclatureServerMetadata` in @pluralscape/types.
 *
 * Nomenclature types live in `packages/types/src/nomenclature.ts` (no
 * per-entity file under `entities/`) because the domain type
 * `NomenclatureSettings` is a `Record<TermCategory, string>` rather
 * than a conventional entity shape. The DB row carries only audit
 * metadata + the T1-encrypted blob — every term category is encrypted
 * (`NomenclatureEncryptedFields` = `TermCategory`), so there is no
 * unencrypted subset on the server row. See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { nomenclatureSettings } from "../../schema/pg/nomenclature-settings.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, NomenclatureServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Nomenclature Drizzle parity", () => {
  it("nomenclature_settings Drizzle row has the same property keys as NomenclatureServerMetadata", () => {
    type Row = InferSelectModel<typeof nomenclatureSettings>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof NomenclatureServerMetadata>();
  });

  it("nomenclature_settings Drizzle row equals NomenclatureServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof nomenclatureSettings>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<NomenclatureServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
