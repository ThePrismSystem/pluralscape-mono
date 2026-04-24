/**
 * Drizzle parity check: the Note row shape inferred from the `notes` table
 * structurally matches `NoteServerMetadata` in @pluralscape/types.
 *
 * Hybrid entity with polymorphic author: plaintext (`authorEntityType`,
 * `authorEntityId`) + opaque `encryptedData` (carries `title`, `body`, tags,
 * etc). `authorEntityId` is a polymorphic branded ID (`AnyBrandedId`).
 */

import { describe, expectTypeOf, it } from "vitest";

import { notes } from "../../schema/pg/communication.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, NoteServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Note Drizzle parity", () => {
  it("notes Drizzle row has the same property keys as NoteServerMetadata", () => {
    type Row = InferSelectModel<typeof notes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof NoteServerMetadata>();
  });

  it("notes Drizzle row equals NoteServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof notes>;
    expectTypeOf<Equal<StripBrands<Row>, StripBrands<NoteServerMetadata>>>().toEqualTypeOf<true>();
  });
});
