import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create a group in the given system and return its ID and version.
 */
export async function createGroup(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  opts: { name?: string; parentGroupId?: string | null } = {},
): Promise<{ id: string; version: number }> {
  const { name = "E2E Test Group", parentGroupId = null } = opts;
  const res = await request.post(`/v1/systems/${systemId}/groups`, {
    headers,
    data: { encryptedData: encryptForApi({ name }), parentGroupId, sortOrder: 0 },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}
