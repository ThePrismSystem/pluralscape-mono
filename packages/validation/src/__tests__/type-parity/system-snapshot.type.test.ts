import { describe, expectTypeOf, it } from "vitest";

import { SnapshotContentSchema } from "../../snapshot.js";

import type { Equal, SnapshotContent } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("SystemSnapshot Zod parity (Class C — SnapshotContent)", () => {
  it("z.infer<typeof SnapshotContentSchema> equals SnapshotContent", () => {
    expectTypeOf<
      Equal<z.infer<typeof SnapshotContentSchema>, SnapshotContent>
    >().toEqualTypeOf<true>();
  });
});
