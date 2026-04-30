/**
 * Shared fixtures for fronting-comment unit test suites.
 * Used by create-list-get and update-lifecycle test files.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../../helpers/test-auth.js";

import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

export const SYSTEM_ID = brandId<SystemId>("sys_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
export const SESSION_ID = brandId<FrontingSessionId>("fs_b2c3d4e5-f6a7-8901-bcde-f12345678901");
export const COMMENT_ID = brandId<FrontingCommentId>("fc_c3d4e5f6-a7b8-9012-cdef-123456789012");
export const MEMBER_ID = brandId<MemberId>("mem_d4e5f6a7-b8c9-0123-defa-234567890123");
export const CF_ID = brandId<CustomFrontId>("cf_e5f6a7b8-c9d0-1234-efab-345678901234");
export const SE_ID = brandId<SystemStructureEntityId>("ste_f6a7b8c9-d0e1-2345-fabc-456789012345");

export const AUTH = makeTestAuth({
  accountId: "acct_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  systemId: SYSTEM_ID,
  sessionId: "sess_b2c3d4e5-f6a7-8901-bcde-f12345678901",
});

export function makeCommentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: COMMENT_ID,
    frontingSessionId: SESSION_ID,
    systemId: SYSTEM_ID,
    memberId: MEMBER_ID,
    customFrontId: null,
    structureEntityId: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
