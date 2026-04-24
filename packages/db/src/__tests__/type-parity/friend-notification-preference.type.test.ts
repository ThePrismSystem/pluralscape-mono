/**
 * Drizzle parity check: the FriendNotificationPreference row shape
 * inferred from the `friend_notification_preferences` table structurally
 * matches `FriendNotificationPreferenceServerMetadata` in
 * @pluralscape/types.
 *
 * Plaintext entity — the domain extends `AuditMetadata` which carries a
 * `version`, but the `friend_notification_preferences` table is not
 * versioned (row operations are idempotent per account + friend
 * connection pair), so the server metadata omits the `version` key.
 * Relaxes `archived` to the raw boolean column. See `member.type.test.ts`
 * for the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { friendNotificationPreferences } from "../../schema/pg/notifications.js";

import type { Equal, FriendNotificationPreferenceServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("FriendNotificationPreference Drizzle parity", () => {
  it("friend_notification_preferences Drizzle row has the same property keys as FriendNotificationPreferenceServerMetadata", () => {
    type Row = InferSelectModel<typeof friendNotificationPreferences>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof FriendNotificationPreferenceServerMetadata>();
  });

  it("friend_notification_preferences Drizzle row equals FriendNotificationPreferenceServerMetadata", () => {
    type Row = InferSelectModel<typeof friendNotificationPreferences>;
    expectTypeOf<Equal<Row, FriendNotificationPreferenceServerMetadata>>().toEqualTypeOf<true>();
  });
});
