/**
 * Shared fixtures for group unit test suites.
 * Used by create-list-get, update-delete, and structure-lifecycle.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { GroupId, SystemId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_test-system");
export const GROUP_ID = brandId<GroupId>("grp_test-group");

export const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

export const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

export function makeGroupRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: GROUP_ID,
    systemId: SYSTEM_ID,
    parentGroupId: null,
    sortOrder: 0,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}
