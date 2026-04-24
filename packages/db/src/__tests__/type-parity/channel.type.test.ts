/**
 * Drizzle parity check: the Channel row shape inferred from the `channels`
 * table structurally matches `ChannelServerMetadata` in @pluralscape/types.
 *
 * Hybrid entity: plaintext (`type`, `parentId`, `sortOrder`) + opaque
 * `encryptedData`. The domain's `name` field lives inside `encryptedData`
 * and is absent from both the server row and this parity check. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { channels } from "../../schema/pg/communication.js";

import type { StripBrands } from "./__helpers__.js";
import type { ChannelServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("Channel Drizzle parity", () => {
  it("channels Drizzle row has the same property keys as ChannelServerMetadata", () => {
    type Row = InferSelectModel<typeof channels>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof ChannelServerMetadata>();
  });

  it("channels Drizzle row equals ChannelServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof channels>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<ChannelServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
