import { expect } from "@playwright/test";

import { encryptForApi } from "./crypto.fixture.js";

import type { APIRequestContext } from "@playwright/test";

/** HTTP 201 Created status code. */
const HTTP_CREATED = 201;

/**
 * Fetch the first system ID for the authenticated account.
 */
export async function getSystemId(
  request: APIRequestContext,
  headers: Record<string, string>,
): Promise<string> {
  const res = await request.get("/v1/systems", { headers });
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { items: Array<{ id: string }> };
  const first = body.items[0] as { id: string } | undefined;
  if (!first) throw new Error("No systems found for authenticated account");
  return first.id;
}

/**
 * Create a member in the given system and return its ID and version.
 */
export async function createMember(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  name = "E2E Test Member",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/members`, {
    headers,
    data: { encryptedData: encryptForApi({ name }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}
