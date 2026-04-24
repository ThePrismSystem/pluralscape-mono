/**
 * Drizzle parity check: the webhook_configs row shape inferred from the
 * `webhook_configs` table structurally matches `WebhookConfigServerMetadata`
 * in @pluralscape/types.
 *
 * WebhookConfig is a plaintext entity. The DB row carries the domain
 * `WebhookConfig` (including the T3-readable HMAC `secret` used for
 * signing outbound payloads) plus the archivable consistency columns
 * (`archivedAt`) that the domain's `archived: false` literal doesn't
 * carry. See `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { webhookConfigs } from "../../schema/pg/webhooks.js";

import type { Equal, WebhookConfigServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("WebhookConfig Drizzle parity", () => {
  it("webhook_configs Drizzle row has the same property keys as WebhookConfigServerMetadata", () => {
    type Row = InferSelectModel<typeof webhookConfigs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof WebhookConfigServerMetadata>();
  });

  it("webhook_configs Drizzle row equals WebhookConfigServerMetadata", () => {
    type Row = InferSelectModel<typeof webhookConfigs>;
    expectTypeOf<Equal<Row, WebhookConfigServerMetadata>>().toEqualTypeOf<true>();
  });
});
