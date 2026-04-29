/**
 * Drizzle parity check for `friend_codes`.
 *
 * The Drizzle row is structurally flat (`archived: boolean`, `archivedAt:
 * UnixMillis | null`). The application-facing `FriendCodeServerMetadata`
 * is the discriminated `Archivable<>` union. This file pins the flat row
 * shape against a locally-defined `Row` type so the assertion is
 * independent of any public type changes.
 * See ADR-023 § Archivable plaintext entities for the convention.
 */

import { describe, expectTypeOf, it } from "vitest";

import { friendCodes } from "../../schema/pg/privacy.js";

import type { Equal, FriendCode, UnixMillis } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

/** Flat shape of the `friend_codes` Drizzle row — local to this parity test. */
type FriendCodeServerMetadataRow = Omit<FriendCode, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

describe("FriendCode Drizzle parity", () => {
  it("friend_codes Drizzle row has the same property keys as the flat row helper", () => {
    type Row = InferSelectModel<typeof friendCodes>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FriendCodeServerMetadataRow>();
  });

  it("friend_codes Drizzle row equals the flat row helper", () => {
    type Row = InferSelectModel<typeof friendCodes>;
    expectTypeOf<Equal<Row, FriendCodeServerMetadataRow>>().toEqualTypeOf<true>();
  });
});
