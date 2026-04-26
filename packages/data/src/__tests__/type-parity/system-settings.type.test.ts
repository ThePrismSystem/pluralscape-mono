/**
 * G4 parity (Body Zod ↔ Transform output) for SystemSettings (and Nomenclature).
 *
 * Anchored to `ReturnType<typeof encryptSystemSettingsUpdate>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  UpdateNomenclatureBodySchema,
  UpdateSystemSettingsBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "../../transforms/system-settings.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("SystemSettings G4 parity (transform output ↔ Zod body schema)", () => {
  it("UpdateSystemSettingsBodySchema's encryptedData+version slice equals encryptSystemSettingsUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateSystemSettingsBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptSystemSettingsUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateNomenclatureBodySchema's encryptedData+version slice equals encryptNomenclatureUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateNomenclatureBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptNomenclatureUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
