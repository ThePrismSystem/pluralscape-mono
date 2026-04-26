/**
 * G4 parity (Body Zod ↔ Transform output) for FrontingSession.
 *
 * Anchored to `ReturnType<typeof encryptFrontingSessionInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateFrontingSessionBodySchema,
  UpdateFrontingSessionBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptFrontingSessionInput,
  encryptFrontingSessionUpdate,
} from "../../transforms/fronting-session.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingSession G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateFrontingSessionBodySchema's encryptedData slice equals encryptFrontingSessionInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateFrontingSessionBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptFrontingSessionInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateFrontingSessionBodySchema's encryptedData+version slice equals encryptFrontingSessionUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateFrontingSessionBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptFrontingSessionUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
