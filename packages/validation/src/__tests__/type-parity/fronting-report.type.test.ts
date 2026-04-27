/**
 * G3 parity for FrontingReport (Domain ↔ Zod encrypted input).
 */

import { describe, expectTypeOf, it } from "vitest";

import { FrontingReportEncryptedInputSchema } from "../../fronting-report.js";

import type { Equal, FrontingReport, FrontingReportEncryptedInput } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("FrontingReport parity (G3: Domain ↔ Zod encrypted input)", () => {
  it("FrontingReportEncryptedInputSchema matches FrontingReportEncryptedInput", () => {
    expectTypeOf<
      Equal<z.infer<typeof FrontingReportEncryptedInputSchema>, FrontingReportEncryptedInput>
    >().toEqualTypeOf<true>();
  });

  it("FrontingReportEncryptedInput is a Pick<FrontingReport, K>", () => {
    expectTypeOf<
      Equal<FrontingReportEncryptedInput, Pick<FrontingReport, keyof FrontingReportEncryptedInput>>
    >().toEqualTypeOf<true>();
  });
});
