import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create a field definition in the given system and return its ID and version.
 */
export async function createFieldDefinition(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  opts: { fieldType?: string; name?: string } = {},
): Promise<{ id: string; version: number }> {
  const { fieldType = "text", name = "E2E Test Field" } = opts;
  const res = await request.post(`/v1/systems/${systemId}/fields`, {
    headers,
    data: {
      fieldType,
      encryptedData: encryptForApi({ name }),
      sortOrder: 0,
      required: false,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}
