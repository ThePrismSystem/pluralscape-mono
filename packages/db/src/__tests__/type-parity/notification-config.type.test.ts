/**
 * Drizzle parity check: the NotificationConfig row shape inferred from
 * the `notification_configs` table structurally matches
 * `NotificationConfigServerMetadata` in @pluralscape/types.
 *
 * Plaintext entity — relaxes the domain's `archived: false` literal to
 * the raw boolean column and adds the nullable `archivedAt` that the
 * archivable-consistency check requires. See `member.type.test.ts` for
 * the general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { notificationConfigs } from "../../schema/pg/notifications.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, NotificationConfigServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("NotificationConfig Drizzle parity", () => {
  it("notification_configs Drizzle row has the same property keys as NotificationConfigServerMetadata", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof NotificationConfigServerMetadata>();
  });

  it("notification_configs Drizzle row equals NotificationConfigServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<NotificationConfigServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
