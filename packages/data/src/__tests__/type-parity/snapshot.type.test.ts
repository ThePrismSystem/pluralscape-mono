/**
 * G4 parity (Body Zod ↔ Transform output) for Snapshot.
 *
 * Anchored to `ReturnType<typeof encryptSnapshotInput>`, so a transform
 * return-type drift fails this test mechanically. Lives in `@pluralscape/data`
 * because data depends on validation; the inverse import path would create a
 * workspace cycle. See bean `types-1spw`.
 */

import { CreateSnapshotBodySchema } from "@pluralscape/validation";
import { describe, expectTypeOf, it } from "vitest";

import { encryptSnapshotInput } from "../../transforms/snapshot.js";

import type { Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Snapshot G4 parity (transform output ↔ Zod body schema)", () => {
  it("CreateSnapshotBodySchema's encryptedData slice equals encryptSnapshotInput output", () => {
    type CreateBodyEncryptedSlice = Pick<z.infer<typeof CreateSnapshotBodySchema>, "encryptedData">;
    type TransformOutput = ReturnType<typeof encryptSnapshotInput>;
    expectTypeOf<Equal<CreateBodyEncryptedSlice, TransformOutput>>().toEqualTypeOf<true>();
  });
});
