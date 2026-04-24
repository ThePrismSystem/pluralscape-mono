/**
 * Drizzle parity check: the TimerConfig row shape inferred from the
 * `timer_configs` table structurally matches `TimerConfigServerMetadata`
 * in @pluralscape/types.
 *
 * Hybrid entity: plaintext (interval, waking hours, scheduling columns) +
 * opaque `encryptedData` (carries `promptText`).
 */

import { describe, expectTypeOf, it } from "vitest";

import { timerConfigs } from "../../schema/pg/timers.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, TimerConfigServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("TimerConfig Drizzle parity", () => {
  it("timerConfigs Drizzle row has the same property keys as TimerConfigServerMetadata", () => {
    type Row = InferSelectModel<typeof timerConfigs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof TimerConfigServerMetadata>();
  });

  it("timerConfigs Drizzle row equals TimerConfigServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof timerConfigs>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<TimerConfigServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
