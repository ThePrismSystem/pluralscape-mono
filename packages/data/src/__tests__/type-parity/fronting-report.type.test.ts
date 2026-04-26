/**
 * G4 parity (Body Zod ↔ Transform output) for FrontingReport.
 *
 * Anchored to `ReturnType<typeof encryptFrontingReportInput>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateFrontingReportBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptFrontingReportInput } from "../../transforms/fronting-report.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingReport G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateFrontingReportBodySchema's encryptedData slice equals encryptFrontingReportInput output", () => {
    type CreateBodyEncryptedSlice = Pick<
      z.infer<typeof CreateFrontingReportBodySchema>,
      "encryptedData"
    >;
    type TransformOutput = ReturnType<typeof encryptFrontingReportInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
