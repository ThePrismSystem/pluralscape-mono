/**
 * Drizzle parity check for `notification_configs`.
 *
 * The Drizzle row is structurally flat (`archived: boolean`, `archivedAt:
 * UnixMillis | null`). The application-facing
 * `NotificationConfigServerMetadata` is the discriminated `Archivable<>`
 * union. This file pins the flat row shape against a locally-defined
 * `Row` type so the assertion is independent of any public type changes.
 * See ADR-023 § Archivable plaintext entities for the convention.
 */

import { describe, expectTypeOf, it } from "vitest";

import { notificationConfigs } from "../../schema/pg/notifications.js";

import type { Equal, NotificationConfig, UnixMillis } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

/** Flat shape of the `notification_configs` Drizzle row — local to this parity test. */
type NotificationConfigServerMetadataRow = Omit<NotificationConfig, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

describe("NotificationConfig Drizzle parity", () => {
  it("notification_configs Drizzle row has the same property keys as the flat row helper", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof NotificationConfigServerMetadataRow>();
  });

  it("notification_configs Drizzle row equals the flat row helper", () => {
    type Row = InferSelectModel<typeof notificationConfigs>;
    expectTypeOf<Equal<Row, NotificationConfigServerMetadataRow>>().toEqualTypeOf<true>();
  });
});
