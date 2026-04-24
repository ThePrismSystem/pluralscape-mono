/**
 * Drizzle parity check: the AccountPurgeRequest row shape inferred from
 * the `account_purge_requests` table structurally matches
 * `AccountPurgeRequestServerMetadata` in @pluralscape/types.
 *
 * Account purge requests are plaintext operational metadata the server
 * owns end-to-end; the DB row matches the domain type exactly. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { accountPurgeRequests } from "../../schema/pg/import-export.js";

import type { AccountPurgeRequestServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("AccountPurgeRequest Drizzle parity", () => {
  it("account_purge_requests Drizzle row has the same property keys as AccountPurgeRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof accountPurgeRequests>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof AccountPurgeRequestServerMetadata>();
  });

  it("account_purge_requests Drizzle row equals AccountPurgeRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof accountPurgeRequests>;
    expectTypeOf<Equal<Row, AccountPurgeRequestServerMetadata>>().toEqualTypeOf<true>();
  });
});
