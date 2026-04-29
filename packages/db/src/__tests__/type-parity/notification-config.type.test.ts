import { describe, expectTypeOf, it } from "vitest";

import { notificationConfigs } from "../../schema/pg/notifications.js";

import type { Equal, NotificationConfigServerMetadataRow } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("NotificationConfig Drizzle parity", () => {
  it("notification_configs Drizzle row has the same property keys as NotificationConfigServerMetadataRow", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof NotificationConfigServerMetadataRow>();
  });

  it("notification_configs Drizzle row equals NotificationConfigServerMetadataRow (flat shape)", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<Equal<Row, NotificationConfigServerMetadataRow>>().toEqualTypeOf<true>();
  });
});
