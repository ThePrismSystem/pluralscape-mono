/**
 * Shared fixtures for field-value unit test suites.
 * Used by member-path and polymorphic test files.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type { FieldDefinitionId, MemberId, SystemId } from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_test-system");
export const MEMBER_ID = brandId<MemberId>("mem_test-member");
export const FIELD_DEF_ID = brandId<FieldDefinitionId>("fld_test-field");

export const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

export const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

export function makeFieldValueRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "fv_test-value",
    fieldDefinitionId: FIELD_DEF_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
