/**
 * Drizzle parity check: the InnerWorldCanvas row shape inferred from the
 * `innerworld_canvas` table structurally matches
 * `InnerWorldCanvasServerMetadata` in @pluralscape/types.
 *
 * Canvas is a singleton per-system table (primary key is `systemId`, no
 * archivable lifecycle). The domain `InnerWorldCanvas` type carries no
 * audit metadata; the server-side type adds `version`, `createdAt`,
 * `updatedAt`, and the opaque `encryptedData` blob that the row stores.
 */

import { describe, expectTypeOf, it } from "vitest";

import { innerworldCanvas } from "../../schema/pg/innerworld.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, InnerWorldCanvasServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("InnerWorldCanvas Drizzle parity", () => {
  it("innerworld_canvas Drizzle row has the same property keys as InnerWorldCanvasServerMetadata", () => {
    type Row = InferSelectModel<typeof innerworldCanvas>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof InnerWorldCanvasServerMetadata>();
  });

  it("innerworld_canvas Drizzle row equals InnerWorldCanvasServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof innerworldCanvas>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<InnerWorldCanvasServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
