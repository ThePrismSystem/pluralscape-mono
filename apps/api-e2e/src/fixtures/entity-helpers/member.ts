import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create a member in the given system and return its ID and version.
 */
export async function createMember(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  name = "E2E Test Member",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/members`, {
    headers,
    data: { encryptedData: encryptForApi({ name }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a custom front in the given system and return its ID and version.
 */
export async function createCustomFront(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  label = "E2E Test Custom Front",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/custom-fronts`, {
    headers,
    data: { encryptedData: encryptForApi({ label }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a fronting session in the given system and return its ID and version.
 */
export async function createFrontingSession(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  memberId: string,
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/fronting-sessions`, {
    headers,
    data: {
      memberId,
      startTime: Date.now(),
      encryptedData: encryptForApi({ note: "E2E test session" }),
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a relationship between two members and return its ID and version.
 */
export async function createRelationship(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  sourceMemberId: string,
  targetMemberId: string,
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/relationships`, {
    headers,
    data: {
      sourceMemberId,
      targetMemberId,
      type: "sibling",
      bidirectional: true,
      encryptedData: encryptForApi({ description: "E2E test relationship" }),
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a member photo and return its ID.
 */
export async function createMemberPhoto(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  memberId: string,
): Promise<{ id: string }> {
  const res = await request.post(`/v1/systems/${systemId}/members/${memberId}/photos`, {
    headers,
    data: {
      encryptedData: encryptForApi({ caption: "E2E test photo" }),
      sortOrder: 0,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string } }>(res);
  return { id: body.data.id };
}
