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

/**
 * Create a group in the given system and return its ID and version.
 */
export async function createGroup(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { name?: string; parentGroupId?: string | null } = {},
): Promise<{ id: string; version: number }> {
  const { name = "E2E Test Group", parentGroupId = null } = opts;
  const res = await request.post(`/v1/systems/${systemId}/groups`, {
    headers,
    data: { encryptedData: encryptForApi({ name }), parentGroupId, sortOrder: 0 },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a custom front in the given system and return its ID and version.
 */
export async function createCustomFront(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  label = "E2E Test Custom Front",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/custom-fronts`, {
    headers,
    data: { encryptedData: encryptForApi({ label }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a field definition in the given system and return its ID and version.
 */
export async function createFieldDefinition(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a fronting session in the given system and return its ID and version.
 */
export async function createFrontingSession(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a relationship between two members and return its ID and version.
 */
export async function createRelationship(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a channel in the given system and return its ID and version.
 */
export async function createChannel(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { type?: "category" | "channel"; parentId?: string; name?: string } = {},
): Promise<{ id: string; version: number }> {
  const { type = "channel", parentId, name = "E2E Test Channel" } = opts;
  const data: Record<string, unknown> = {
    encryptedData: encryptForApi({ name }),
    type,
    sortOrder: 0,
  };
  if (parentId) data.parentId = parentId;
  const res = await request.post(`/v1/systems/${systemId}/channels`, {
    headers,
    data,
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create a message in a channel and return its ID and version.
 */
export async function createMessage(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  channelId: string,
  content = "E2E Test Message",
): Promise<{ id: string; version: number; timestamp: number }> {
  const timestamp = Date.now();
  const res = await request.post(`/v1/systems/${systemId}/channels/${channelId}/messages`, {
    headers,
    data: {
      encryptedData: encryptForApi({ content }),
      timestamp,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number; timestamp: number };
  return { id: body.id, version: body.version, timestamp: body.timestamp };
}

/**
 * Create a poll in the given system and return its ID and version.
 */
export async function createPoll(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: {
    title?: string;
    kind?: "standard" | "custom";
    allowMultipleVotes?: boolean;
    maxVotesPerMember?: number;
    allowAbstain?: boolean;
    allowVeto?: boolean;
    endsAt?: number;
  } = {},
): Promise<{ id: string; version: number }> {
  const {
    title = "E2E Test Poll",
    kind = "standard",
    allowMultipleVotes = false,
    maxVotesPerMember = 1,
    allowAbstain = false,
    allowVeto = false,
    endsAt,
  } = opts;
  const data: Record<string, unknown> = {
    encryptedData: encryptForApi({ title, description: null, options: [] }),
    kind,
    allowMultipleVotes,
    maxVotesPerMember,
    allowAbstain,
    allowVeto,
  };
  if (endsAt !== undefined) data.endsAt = endsAt;
  const res = await request.post(`/v1/systems/${systemId}/polls`, {
    headers,
    data,
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}

/**
 * Create an innerworld region in the given system and return its ID and version.
 */
export async function createInnerworldRegion(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/innerworld/regions`, {
    headers,
    data: { encryptedData: encryptForApi({ name: "E2E Test Region" }), parentRegionId: null },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { id: string; version: number };
  return { id: body.id, version: body.version };
}
