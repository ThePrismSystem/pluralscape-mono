/**
 * Drizzle parity check: the Account row shape inferred from the `accounts`
 * table structurally matches `AccountServerMetadata` in @pluralscape/types.
 *
 * Account is a plaintext entity (no encryption). `AccountServerMetadata`
 * extends the domain `Account` with server-only columns the domain doesn't
 * expose: the two-phase registration challenge (nonce + expiry), the
 * server-held encrypted email (ADR 029), and the `auditLogIpTracking`
 * toggle (ADR 028). See `member.type.test.ts` for the general rationale
 * behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { accounts } from "../../schema/pg/auth.js";

import type { AccountServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Account Drizzle parity", () => {
  it("accounts Drizzle row has the same property keys as AccountServerMetadata", () => {
    type Row = InferSelectModel<typeof accounts>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof AccountServerMetadata>();
  });

  it("accounts Drizzle row equals AccountServerMetadata", () => {
    type Row = InferSelectModel<typeof accounts>;
    expectTypeOf<Equal<Row, AccountServerMetadata>>().toEqualTypeOf<true>();
  });
});
