/**
 * Shared fixtures for webhook-config unit test suites.
 * Used by create-list-get and update-delete-lifecycle test files.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { SystemId, WebhookId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_00000000-0000-4000-a000-000000000001");
export const WH_ID = brandId<WebhookId>("wh_00000000-0000-4000-a000-000000000002");

export const AUTH = makeTestAuth({
  accountId: "acct_00000000-0000-4000-a000-000000000003",
  systemId: SYSTEM_ID,
  sessionId: "sess_00000000-0000-4000-a000-000000000004",
});

export function makeWebhookRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: WH_ID,
    systemId: SYSTEM_ID,
    url: "https://example.com/webhook",
    eventTypes: ["member.created"],
    enabled: true,
    cryptoKeyId: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
