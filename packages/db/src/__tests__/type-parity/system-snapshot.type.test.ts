/**
 * Drizzle parity check: the SystemSnapshot row shape inferred from the
 * `system_snapshots` table structurally matches
 * `SystemSnapshotServerMetadata` in @pluralscape/types.
 *
 * SystemSnapshot is a hybrid entity: plaintext metadata + opaque
 * `encryptedData` blob whose decrypted shape (`SnapshotContent`) lives in
 * its own type, not as a keys-subset of `SystemSnapshot`. The server
 * metadata renames the domain's `trigger` to the DB column's
 * `snapshotTrigger`. See `member.type.test.ts` for the general rationale
 * behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemSnapshots } from "../../schema/pg/snapshots.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SystemSnapshotServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemSnapshot Drizzle parity", () => {
  it("system_snapshots Drizzle row has the same property keys as SystemSnapshotServerMetadata", () => {
    type Row = InferSelectModel<typeof systemSnapshots>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemSnapshotServerMetadata>();
  });

  it("system_snapshots Drizzle row equals SystemSnapshotServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof systemSnapshots>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SystemSnapshotServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
