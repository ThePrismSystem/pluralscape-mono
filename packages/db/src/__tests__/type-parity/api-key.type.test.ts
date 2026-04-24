/**
 * Drizzle parity check: the ApiKey row shape inferred from the `api_keys`
 * table structurally matches `ApiKeyServerMetadata` in @pluralscape/types.
 *
 * ApiKey is a hybrid entity: the domain type is a discriminated union
 * (metadata vs crypto) plus AuditMetadata; the server row flattens the
 * discriminated shape into a single table and stores non-operational
 * fields (name, publicKey) inside `encryptedData`. The ServerMetadata
 * type mirrors the actual DB columns. See `member.type.test.ts` for the
 * general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { apiKeys } from "../../schema/pg/api-keys.js";

import type { StripBrands } from "./__helpers__.js";
import type { ApiKeyServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("ApiKey Drizzle parity", () => {
  it("api_keys Drizzle row has the same property keys as ApiKeyServerMetadata", () => {
    type Row = InferSelectModel<typeof apiKeys>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof ApiKeyServerMetadata>();
  });

  it("api_keys Drizzle row equals ApiKeyServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof apiKeys>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<ApiKeyServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
