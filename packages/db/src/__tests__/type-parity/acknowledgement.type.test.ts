/**
 * Drizzle parity check: the AcknowledgementRequest row shape inferred from
 * the `acknowledgements` table structurally matches
 * `AcknowledgementRequestServerMetadata` in @pluralscape/types.
 *
 * Hybrid entity: plaintext (`createdByMemberId`, `status`) + opaque
 * `encryptedData` (carries title, body, recipients list).
 */

import { describe, expectTypeOf, it } from "vitest";

import { acknowledgements } from "../../schema/pg/communication.js";

import type { AcknowledgementRequestServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("AcknowledgementRequest Drizzle parity", () => {
  it("acknowledgements Drizzle row has the same property keys as AcknowledgementRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof acknowledgements>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof AcknowledgementRequestServerMetadata>();
  });

  it("acknowledgements Drizzle row equals AcknowledgementRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof acknowledgements>;
    expectTypeOf<Equal<Row, AcknowledgementRequestServerMetadata>>().toEqualTypeOf<true>();
  });
});
