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
  const body = (await res.json()) as { data: Array<{ id: string }> };
  const first = body.data[0] as { id: string } | undefined;
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number; timestamp: number } };
  return { id: body.data.id, version: body.data.version, timestamp: body.data.timestamp };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create an acknowledgement in the given system and return its ID and version.
 */
export async function createAcknowledgement(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a privacy bucket in the given system and return its ID and version.
 */
export async function createBucket(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  name = "E2E Test Bucket",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/buckets`, {
    headers,
    data: { encryptedData: encryptForApi({ name }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a structure entity type in the given system and return its ID and version.
 */
export async function createStructureEntityType(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { name?: string } = {},
): Promise<{ id: string; version: number }> {
  const { name = "E2E Test Entity Type" } = opts;
  const res = await request.post(`/v1/systems/${systemId}/structure/entity-types`, {
    headers,
    data: { encryptedData: encryptForApi({ name }), sortOrder: 0 },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a structure entity in the given system and return its ID and version.
 */
export async function createStructureEntity(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create an API key in the given system and return its ID.
 */
export async function createApiKey(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { keyType?: "metadata" | "crypto"; scopes?: string[] } = {},
): Promise<{ id: string }> {
  const { keyType = "metadata", scopes = ["read:members"] } = opts;
  const data: Record<string, unknown> = {
    keyType,
    scopes,
    encryptedData: encryptForApi({ label: "E2E Test API Key" }),
  };
  if (keyType === "crypto") {
    data.encryptedKeyMaterial = "dGVzdC1lbmNyeXB0ZWQta2V5LW1hdGVyaWFs";
  }
  const res = await request.post(`/v1/systems/${systemId}/api-keys`, {
    headers,
    data,
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id };
}

/**
 * Create a system snapshot in the given system and return its ID.
 */
export async function createSnapshot(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { trigger?: "manual" | "scheduled-daily" | "scheduled-weekly" } = {},
): Promise<{ id: string }> {
  const { trigger = "manual" } = opts;
  const res = await request.post(`/v1/systems/${systemId}/snapshots`, {
    headers,
    data: {
      snapshotTrigger: trigger,
      encryptedData: encryptForApi({ note: "E2E test snapshot" }),
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id };
}

/**
 * Create a timer config in the given system and return its ID and version.
 */
export async function createTimerConfig(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/timer-configs`, {
    headers,
    data: {
      encryptedData: encryptForApi({ label: "E2E Test Timer" }),
      intervalMinutes: 60,
      enabled: true,
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a check-in record in the given system and return its ID.
 */
export async function createCheckInRecord(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  timerConfigId: string,
): Promise<{ id: string }> {
  const res = await request.post(`/v1/systems/${systemId}/check-in-records`, {
    headers,
    data: {
      timerConfigId,
      scheduledAt: Date.now(),
      encryptedData: encryptForApi({ note: "E2E test check-in" }),
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id };
}

/**
 * Create a lifecycle event in the given system and return its ID and version.
 */
export async function createLifecycleEvent(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
  opts: { eventType?: string } = {},
): Promise<{ id: string; version: number }> {
  const { eventType = "discovery" } = opts;
  const res = await request.post(`/v1/systems/${systemId}/lifecycle-events`, {
    headers,
    data: {
      eventType,
      occurredAt: Date.now(),
      encryptedData: encryptForApi({ description: "E2E test event" }),
    },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = (await res.json()) as { data: { id: string; version: number } };
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a member photo and return its ID.
 */
export async function createMemberPhoto(
  request: APIRequestContext,
  headers: Record<string, string>,
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
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id };
}

/**
 * Run the three-step setup wizard so system settings exist.
 *
 * The PIN endpoints require a `system_settings` row which is only
 * created during the setup flow (nomenclature -> profile -> complete).
 */
export async function ensureSystemSetup(
  request: APIRequestContext,
  headers: Record<string, string>,
  systemId: string,
): Promise<void> {
  const nomenclatureRes = await request.post(`/v1/systems/${systemId}/setup/nomenclature`, {
    headers,
    data: { encryptedData: encryptForApi({ terminology: "default" }) },
  });
  expect(nomenclatureRes.ok()).toBe(true);

  const profileRes = await request.post(`/v1/systems/${systemId}/setup/profile`, {
    headers,
    data: { encryptedData: encryptForApi({ name: "E2E System" }) },
  });
  expect(profileRes.ok()).toBe(true);

  const completeRes = await request.post(`/v1/systems/${systemId}/setup/complete`, {
    headers,
    data: {
      encryptedData: encryptForApi({ settings: "default" }),
      recoveryKeyBackupConfirmed: true,
    },
  });
  expect(completeRes.ok()).toBe(true);
}
