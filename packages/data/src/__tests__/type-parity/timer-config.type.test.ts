/**
 * G4 parity (Body Zod ↔ Transform output) for TimerConfig.
 *
 * Anchored to `ReturnType<typeof encryptTimerConfigInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateTimerConfigBodySchema, UpdateTimerConfigBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptTimerConfigInput,
  encryptTimerConfigUpdate,
} from "../../transforms/timer-check-in.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("TimerConfig G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateTimerConfigBodySchema's encryptedData slice equals encryptTimerConfigInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateTimerConfigBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptTimerConfigInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateTimerConfigBodySchema's encryptedData+version slice equals encryptTimerConfigUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateTimerConfigBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptTimerConfigUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
