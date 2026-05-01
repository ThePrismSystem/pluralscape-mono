import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { HTTP_CREATED, parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Create an API key in the given system and return its ID.
 */
export async function createApiKey(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string } }>(res);
  return { id: body.data.id };
}

/**
 * Create a system snapshot in the given system and return its ID.
 */
export async function createSnapshot(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string } }>(res);
  return { id: body.data.id };
}

/**
 * Create a privacy bucket in the given system and return its ID and version.
 */
export async function createBucket(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
  name = "E2E Test Bucket",
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/buckets`, {
    headers,
    data: { encryptedData: encryptForApi({ name }) },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a timer config in the given system and return its ID and version.
 */
export async function createTimerConfig(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create a check-in record in the given system and return its ID.
 */
export async function createCheckInRecord(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string } }>(res);
  return { id: body.data.id };
}

/**
 * Create a lifecycle event in the given system and return its ID and version.
 */
export async function createLifecycleEvent(
  request: APIRequestContext,
  headers: AuthHeaders,
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
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}

/**
 * Create an innerworld region in the given system and return its ID and version.
 */
export async function createInnerworldRegion(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
): Promise<{ id: string; version: number }> {
  const res = await request.post(`/v1/systems/${systemId}/innerworld/regions`, {
    headers,
    data: { encryptedData: encryptForApi({ name: "E2E Test Region" }), parentRegionId: null },
  });
  expect(res.status()).toBe(HTTP_CREATED);
  const body = await parseJsonBody<{ data: { id: string; version: number } }>(res);
  return { id: body.data.id, version: body.data.version };
}
