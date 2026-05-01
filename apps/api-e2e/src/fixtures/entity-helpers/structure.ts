import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create a structure entity type in the given system and return its ID and version.
 */
export async function createStructureEntityType(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  opts: { name?: string } = {},
): Promise<{ id: string; version: number }> {
  const { name = "E2E Test Entity Type" } = opts;
  const res = await request.post(`/v1/systems/${systemId}/structure/entity-types`, {
    headers,
    data: { encryptedData: encryptForApi({ name }), sortOrder: 0 },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a structure entity in the given system and return its ID and version.
 */
export async function createStructureEntity(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  structureEntityTypeId: string,
  opts: { name?: string; parentEntityId?: string | null } = {},
): Promise<{ id: string; version: number }> {
  const { name = "E2E Test Entity", parentEntityId = null } = opts;
  const res = await request.post(`/v1/systems/${systemId}/structure/entities`, {
    headers,
    data: {
      structureEntityTypeId,
      encryptedData: encryptForApi({ name }),
      parentEntityId,
      sortOrder: 0,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}
