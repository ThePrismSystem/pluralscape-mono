/**
 * Drizzle parity check: the SystemSettings row shape inferred from the
 * `system_settings` table structurally matches
 * `SystemSettingsServerMetadata` in @pluralscape/types.
 *
 * `SystemSettingsServerMetadata` strips the domain's encrypted fields
 * (bundled inside `encryptedData`), `defaultBucketId` (carried inside
 * the blob, not its own column), and `nomenclature` (stored in the
 * `nomenclature_settings` table). It adds `pinHash` and
 * `biometricEnabled` (server-visible for device-transfer policy) plus
 * `encryptedData`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { systemSettings } from "../../schema/pg/system-settings.js";

import type { Equal, SystemSettingsServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("SystemSettings Drizzle parity", () => {
  it("system_settings Drizzle row has the same property keys as SystemSettingsServerMetadata", () => {
    type Row = InferSelectModel<typeof systemSettings>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof SystemSettingsServerMetadata>();
  });

  it("system_settings Drizzle row equals SystemSettingsServerMetadata", () => {
    type Row = InferSelectModel<typeof systemSettings>;
    expectTypeOf<Equal<Row, SystemSettingsServerMetadata>>().toEqualTypeOf<true>();
  });
});
