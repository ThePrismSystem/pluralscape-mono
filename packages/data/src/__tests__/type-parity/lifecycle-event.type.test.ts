/**
 * G4 parity (Body Zod ↔ Transform output) for LifecycleEvent.
 *
 * Anchored to `ReturnType<typeof encryptLifecycleEventInput>` etc., so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import {
  CreateLifecycleEventBodySchema,
  UpdateLifecycleEventBodySchema,
} from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import {
  encryptLifecycleEventInput,
  encryptLifecycleEventUpdate,
} from "../../transforms/lifecycle-event.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("LifecycleEvent G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateLifecycleEventBodySchema's encryptedData slice equals encryptLifecycleEventInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateLifecycleEventBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptLifecycleEventInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });

  it("UpdateLifecycleEventBodySchema's encryptedData+version slice equals encryptLifecycleEventUpdate output", () => {
    type UpdateBodyEncryptedSlice = Pick<
      z.infer<typeof UpdateLifecycleEventBodySchema>,
      "encryptedData" | "version"
    >;
    type TransformOutput = ReturnType<typeof encryptLifecycleEventUpdate>;
    expectTypeOf<Equal<UpdateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
