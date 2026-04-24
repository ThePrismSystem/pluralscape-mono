/**
 * Drizzle parity check: the CheckInRecord row shape inferred from the
 * `check_in_records` table structurally matches
 * `CheckInRecordServerMetadata` in @pluralscape/types.
 *
 * CheckInRecord is a hybrid entity — the domain is plaintext but the
 * server row carries two DB-only columns: a nullable `encryptedData`
 * (optional response payload) and a server-generated `idempotencyKey`
 * (webhook dedup, never exposed to clients). See `member.type.test.ts`
 * for the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { checkInRecords } from "../../schema/pg/timers.js";

import type { StripBrands } from "./__helpers__.js";
import type { CheckInRecordServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("CheckInRecord Drizzle parity", () => {
  it("check_in_records Drizzle row has the same property keys as CheckInRecordServerMetadata", () => {
    type Row = InferSelectModel<typeof checkInRecords>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof CheckInRecordServerMetadata>();
  });

  it("check_in_records Drizzle row equals CheckInRecordServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof checkInRecords>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<CheckInRecordServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
