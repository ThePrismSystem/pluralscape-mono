/**
 * Shared fixture builders for member unit test files.
 * Used by duplicate.test.ts and lifecycle.test.ts (and any other member
 * verb test files that need the standard SYSTEM_ID / MEMBER_ID / AUTH set).
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { MemberId, SystemId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_test-system");
export const MEMBER_ID = brandId<MemberId>("mem_test-member");

export const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

export const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

export function makeMemberRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "mem_test-member",
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}
