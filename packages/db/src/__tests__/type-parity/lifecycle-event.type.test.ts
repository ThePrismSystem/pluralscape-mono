/**
 * Drizzle parity check: the LifecycleEvent row shape inferred from the
 * `lifecycle_events` table structurally matches
 * `LifecycleEventServerMetadata` in @pluralscape/types.
 *
 * LifecycleEvent is an encrypted entity with a single encrypted field
 * (`notes`), but the domain is a discriminated union over 13 event
 * variants whose polymorphic target IDs travel in the
 * `plaintextMetadata` JSONB column. The server metadata carries only the
 * shared `LifecycleEventBase` columns plus the JSONB blob. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { lifecycleEvents } from "../../schema/pg/lifecycle-events.js";

import type { Equal, LifecycleEventServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("LifecycleEvent Drizzle parity", () => {
  it("lifecycle_events Drizzle row has the same property keys as LifecycleEventServerMetadata", () => {
    type Row = InferSelectModel<typeof lifecycleEvents>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof LifecycleEventServerMetadata>();
  });

  it("lifecycle_events Drizzle row equals LifecycleEventServerMetadata", () => {
    type Row = InferSelectModel<typeof lifecycleEvents>;
    expectTypeOf<Equal<Row, LifecycleEventServerMetadata>>().toEqualTypeOf<true>();
  });
});
