/**
 * Shared fixtures for timer-config unit test suites.
 * Used by create-list-get and update-delete-lifecycle.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { SystemId, TimerId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_timer-test-system");
export const TIMER_ID = brandId<TimerId>("tmr_timer-test-config");

export const AUTH = makeTestAuth({
  accountId: "acct_timer-test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_timer-test-session",
});

export function makeTimerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TIMER_ID,
    systemId: SYSTEM_ID,
    enabled: true,
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
