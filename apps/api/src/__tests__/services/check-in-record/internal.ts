/**
 * Shared fixtures for check-in-record unit test suites.
 * Used by create-list-get, respond-dismiss, and archive-delete-parse.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { CheckInRecordId, MemberId, SystemId, TimerId } from "@pluralscape/types";

// IDs that pass through brandedIdQueryParam validation must be prefix + valid UUID
export const SYSTEM_ID = brandId<SystemId>("sys_00000000-0000-4000-a000-000000000001");
export const RECORD_ID = brandId<CheckInRecordId>("cir_00000000-0000-4000-a000-000000000002");
export const TIMER_ID = brandId<TimerId>("tmr_00000000-0000-4000-a000-000000000003");
export const MEMBER_ID = brandId<MemberId>("mem_00000000-0000-4000-a000-000000000004");

export const AUTH = makeTestAuth({
  accountId: "acct_00000000-0000-4000-a000-000000000005",
  systemId: SYSTEM_ID,
  sessionId: "sess_00000000-0000-4000-a000-000000000006",
});

export function makePendingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RECORD_ID,
    systemId: SYSTEM_ID,
    timerConfigId: TIMER_ID,
    scheduledAt: 1000,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    encryptedData: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

export function makeRespondedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...makePendingRow(),
    respondedByMemberId: MEMBER_ID,
    respondedAt: 2000,
    dismissed: false,
    ...overrides,
  };
}

export function makeDismissedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...makePendingRow(),
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: true,
    ...overrides,
  };
}
