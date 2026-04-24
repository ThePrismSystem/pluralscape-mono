/**
 * Drizzle parity check: the BoardMessage row shape inferred from the
 * `board_messages` table structurally matches `BoardMessageServerMetadata`
 * in @pluralscape/types.
 *
 * Hybrid entity: plaintext (`pinned`, `sortOrder`) + opaque `encryptedData`
 * (carries `title`, `body`, author, etc).
 */

import { describe, expectTypeOf, it } from "vitest";

import { boardMessages } from "../../schema/pg/communication.js";

import type { BoardMessageServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("BoardMessage Drizzle parity", () => {
  it("boardMessages Drizzle row has the same property keys as BoardMessageServerMetadata", () => {
    type Row = InferSelectModel<typeof boardMessages>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof BoardMessageServerMetadata>();
  });

  it("boardMessages Drizzle row equals BoardMessageServerMetadata", () => {
    type Row = InferSelectModel<typeof boardMessages>;
    expectTypeOf<Equal<Row, BoardMessageServerMetadata>>().toEqualTypeOf<true>();
  });
});
