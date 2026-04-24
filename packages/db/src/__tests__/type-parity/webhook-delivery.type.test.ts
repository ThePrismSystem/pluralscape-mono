/**
 * Drizzle parity check: the webhook_deliveries row shape inferred from the
 * `webhook_deliveries` table structurally matches
 * `WebhookDeliveryServerMetadata` in @pluralscape/types.
 *
 * WebhookDelivery is a plaintext entity. The DB row carries the domain
 * `WebhookDelivery` plus the server-only `encryptedData` column — the
 * T3-encrypted payload that the server holds and signs at delivery
 * time (server-held key, not E2E). See `member.type.test.ts` for the
 * general rationale behind the brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { webhookDeliveries } from "../../schema/pg/webhooks.js";

import type { StripBrands } from "./__helpers__.js";
import type { Equal, WebhookDeliveryServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("WebhookDelivery Drizzle parity", () => {
  it("webhook_deliveries row has the same property keys as WebhookDeliveryServerMetadata", () => {
    type Row = InferSelectModel<typeof webhookDeliveries>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof WebhookDeliveryServerMetadata>();
  });

  it("webhook_deliveries row equals WebhookDeliveryServerMetadata modulo brands and readonly", () => {
    type Row = InferSelectModel<typeof webhookDeliveries>;
    expectTypeOf<
      Equal<StripBrands<Row>, StripBrands<WebhookDeliveryServerMetadata>>
    >().toEqualTypeOf<true>();
  });
});
