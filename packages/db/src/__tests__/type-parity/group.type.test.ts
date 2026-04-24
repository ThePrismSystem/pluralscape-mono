/**
 * Drizzle parity check: the Group row shape inferred from the `groups`
 * table structurally matches `GroupServerMetadata` in @pluralscape/types.
 *
 * `GroupServerMetadata` strips the encrypted field keys from the domain
 * (`name`, `description`, `imageSource`, `color`, `emoji` ride inside
 * `encryptedData`) and `archived` (the server tracks a mutable boolean
 * with a companion `archivedAt` timestamp, while the domain uses `false`
 * literal). Adds the DB-only columns: `encryptedData` (the T1 blob),
 * `archived`/`archivedAt`. `AuditMetadata` is already on the domain.
 * See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { groups } from "../../schema/pg/groups.js";

import type { Equal, GroupServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Group Drizzle parity", () => {
  it("groups Drizzle row has the same property keys as GroupServerMetadata", () => {
    type Row = InferSelectModel<typeof groups>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof GroupServerMetadata>();
  });

  it("groups Drizzle row equals GroupServerMetadata", () => {
    type Row = InferSelectModel<typeof groups>;
    expectTypeOf<Equal<Row, GroupServerMetadata>>().toEqualTypeOf<true>();
  });
});
