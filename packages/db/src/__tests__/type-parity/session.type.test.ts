/**
 * Drizzle parity check: the Session row shape inferred from the `sessions`
 * table structurally matches `SessionServerMetadata` in @pluralscape/types.
 *
 * Session is a plaintext entity (no client-encrypted field union). The
 * server row extends the domain with two server-only columns: `tokenHash`
 * (opaque-to-domain hash the server compares against on every authenticated
 * request) and nullable `encryptedData` (T1-wrapped `DeviceInfo`). See
 * `member.type.test.ts` for the general rationale behind the brand-stripped
 * comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { sessions } from "../../schema/pg/auth.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, SessionServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Session Drizzle parity", () => {
  it("sessions Drizzle row has the same property keys as SessionServerMetadata", () => {
    type Row = InferSelectModel<typeof sessions>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SessionServerMetadata>();
  });

  it("sessions Drizzle row equals SessionServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof sessions>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<SessionServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
