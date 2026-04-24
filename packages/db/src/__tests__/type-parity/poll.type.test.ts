/**
 * Drizzle parity check: the Poll row shape inferred from the `polls` table
 * structurally matches `PollServerMetadata` in @pluralscape/types.
 *
 * Hybrid entity: plaintext (`kind`, `status`, vote flags, `endsAt`,
 * `createdByMemberId`) + opaque `encryptedData` (carries `title`, `options`).
 */

import { describe, expectTypeOf, it } from "vitest";

import { polls } from "../../schema/pg/communication.js";

import type { Equal, PollServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Poll Drizzle parity", () => {
  it("polls Drizzle row has the same property keys as PollServerMetadata", () => {
    type Row = InferSelectModel<typeof polls>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof PollServerMetadata>();
  });

  it("polls Drizzle row equals PollServerMetadata", () => {
    type Row = InferSelectModel<typeof polls>;
    expectTypeOf<Equal<Row, PollServerMetadata>>().toEqualTypeOf<true>();
  });
});
