/**
 * Shared fixtures for fronting-session unit test suites.
 * Used by create-list-get and update-end-lifecycle test files.
 */
import { brandId } from "@pluralscape/types";

import { makeTestAuth } from "../../helpers/test-auth.js";

import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

export { VALID_BLOB_BASE64 } from "../../helpers/mock-crypto.js";

export const SYSTEM_ID = brandId<SystemId>("sys_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
export const FS_ID = brandId<FrontingSessionId>("fs_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
export const MEMBER_ID = brandId<MemberId>("mem_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
export const CF_ID = brandId<CustomFrontId>("cf_a1b2c3d4-e5f6-7890-abcd-ef1234567890");
export const SE_ID = brandId<SystemStructureEntityId>("ste_a1b2c3d4-e5f6-7890-abcd-ef1234567890");

export const AUTH = makeTestAuth({
  accountId: "acct_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  systemId: SYSTEM_ID,
  sessionId: "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
});

export function makeFSRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: FS_ID,
    systemId: SYSTEM_ID,
    memberId: MEMBER_ID,
    customFrontId: null,
    structureEntityId: null,
    startTime: 1000,
    endTime: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}
