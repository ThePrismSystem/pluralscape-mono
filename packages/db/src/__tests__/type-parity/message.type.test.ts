/**
 * Drizzle parity check: the ChatMessage row shape inferred from the
 * `messages` table structurally matches `ChatMessageServerMetadata` in
 * @pluralscape/types.
 *
 * Hybrid entity: plaintext (`channelId`, `replyToId`, `timestamp`,
 * `editedAt`) + opaque `encryptedData` (carries `senderId`, `content`,
 * `attachments`, `mentions`). Messages are partitioned by timestamp
 * (ADR 019).
 */

import { describe, expectTypeOf, it } from "vitest";

import { messages } from "../../schema/pg/communication.js";

import type { StripBrands } from "./__helpers__.js";
import type { ChatMessageServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("ChatMessage Drizzle parity", () => {
  it("messages Drizzle row has the same property keys as ChatMessageServerMetadata", () => {
    type Row = InferSelectModel<typeof messages>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof ChatMessageServerMetadata>();
  });

  it("messages Drizzle row equals ChatMessageServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof messages>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<ChatMessageServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
