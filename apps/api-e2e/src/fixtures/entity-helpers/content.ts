import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create a channel in the given system and return its ID and version.
 */
export async function createChannel(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a message in a channel and return its ID and version.
 */
export async function createMessage(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string; version: number; timestamp: number } }>(
    res,
  );
  return { id: body.data.id, version: body.data.version, timestamp: body.data.timestamp };
}

/**
 * Create a poll in the given system and return its ID and version.
 */
export async function createPoll(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create an acknowledgement in the given system and return its ID and version.
 */
export async function createAcknowledgement(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  opts: {
    message?: string;
    targetMemberId?: string;
    createdByMemberId?: string;
  } = {},
): Promise<{ id: string; version: number }> {
  const {
    message = "E2E Test Acknowledgement",
    targetMemberId = "mem_00000000-0000-0000-0000-000000000001",
  } = opts;
  const data: Record<string, unknown> = {
    encryptedData: encryptForApi({ message, targetMemberId }),
  };
  if (opts.createdByMemberId !== undefined) data.createdByMemberId = opts.createdByMemberId;
  const res = await request.post(`/v1/systems/${systemId}/acknowledgements`, {
    headers,
    data,
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}
