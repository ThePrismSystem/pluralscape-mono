/**
 * Zod parity check: `z.infer<typeof InnerWorldCanvasEncryptedInputSchema>`
 * structurally matches `Pick<InnerWorldCanvas, InnerWorldCanvasEncryptedFields>`.
 *
 * The canvas route uses `systemId` as a path parameter, so it's absent
 * from both the encrypted payload and the Zod schema; `Pick` honors that
 * by projecting only the encrypted key union.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { InnerWorldCanvasEncryptedInputSchema } from "../../innerworld.js";
import type { Equal, InnerWorldCanvas, InnerWorldCanvasEncryptedFields } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("InnerWorldCanvas Zod parity", () => {
  it("InnerWorldCanvasEncryptedInputSchema matches Pick<InnerWorldCanvas, InnerWorldCanvasEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof InnerWorldCanvasEncryptedInputSchema>,
        Pick<InnerWorldCanvas, InnerWorldCanvasEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });
});
