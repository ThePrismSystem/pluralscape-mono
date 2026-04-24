/**
 * Drizzle parity check: the DeviceToken row shape inferred from the
 * `device_tokens` table structurally matches `DeviceTokenServerMetadata`
 * in @pluralscape/types.
 *
 * The server persists only a `tokenHash` (never the raw push token) and
 * tracks `revokedAt` for invalidation; it does NOT carry `updatedAt` or
 * `version` from `AuditMetadata` because device-token rows are
 * insert-and-revoke only. See `member.type.test.ts` for the general
 * rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { deviceTokens } from "../../schema/pg/notifications.js";

import type { DeviceTokenServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("DeviceToken Drizzle parity", () => {
  it("device_tokens Drizzle row has the same property keys as DeviceTokenServerMetadata", () => {
    type Row = InferSelectModel<typeof deviceTokens>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof DeviceTokenServerMetadata>();
  });

  it("device_tokens Drizzle row equals DeviceTokenServerMetadata", () => {
    type Row = InferSelectModel<typeof deviceTokens>;
    expectTypeOf<Equal<Row, DeviceTokenServerMetadata>>().toEqualTypeOf<true>();
  });
});
