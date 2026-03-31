/**
 * Shared assertion helpers for cross-cutting E2E test concerns.
 *
 * Each helper makes a request and asserts the expected error behavior.
 * All error assertions also verify the standard error envelope shape.
 */
import { expect } from "@playwright/test";

import {
  DEFAULT_PAGINATION_ITEM_COUNT,
  DEFAULT_PAGINATION_PAGE_SIZE,
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_NOT_FOUND,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
  HTTP_UNPROCESSABLE,
  parseJsonBody,
} from "./http.constants.js";

import type { AuthHeaders, HttpMethod } from "./http.constants.js";
import type { APIRequestContext, APIResponse } from "@playwright/test";

// ── Error Shape ─────────────────────────────────────────────────────

interface ErrorEnvelope {
  error: { code: string; message: string };
  requestId: string;
}

/**
 * Verify a response has the standard error envelope shape:
 * `{ error: { code: string; message: string }, requestId: string }`
 *
 * Also verifies no information leakage (no stack traces, file paths, or SQL).
 */
export async function assertErrorShape(response: APIResponse): Promise<void> {
  const body: unknown = await response.json();
  expect(body).toHaveProperty("error");
  expect(body).toHaveProperty("error.code");
  expect(body).toHaveProperty("error.message");
  expect(body).toHaveProperty("requestId");

  const envelope = body as ErrorEnvelope;
  expect(typeof envelope.error.code).toBe("string");
  expect(typeof envelope.error.message).toBe("string");
  expect(typeof envelope.requestId).toBe("string");

  // No information leakage
  const details = JSON.stringify(body);
  expect(details).not.toMatch(/at\s+\w+\s+\(/); // no stack traces
  expect(details).not.toMatch(/\/home\//); // no file paths
  expect(details).not.toMatch(/SELECT|INSERT|UPDATE|DELETE.*FROM/i); // no SQL
}

// ── Auth Rejection ──────────────────────────────────────────────────

/**
 * Hit an endpoint without any auth token and assert 401.
 */
export async function assertRequiresAuth(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<APIResponse> {
  const opts: { headers: Record<string, string>; data?: unknown } = {
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.data = body;

  const res = await makeRequest(request, method, path, opts);
  expect(res.status()).toBe(HTTP_UNAUTHORIZED);
  await assertErrorShape(res);
  return res;
}

/**
 * Hit an endpoint with a garbage Bearer token and assert 401.
 */
export async function assertRejectsGarbageToken(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<APIResponse> {
  const opts: { headers: Record<string, string>; data?: unknown } = {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer not-a-valid-session-token",
    },
  };
  if (body !== undefined) opts.data = body;

  const res = await makeRequest(request, method, path, opts);
  expect(res.status()).toBe(HTTP_UNAUTHORIZED);
  await assertErrorShape(res);
  return res;
}

// ── IDOR Rejection ──────────────────────────────────────────────────

/**
 * Hit an endpoint with valid auth from a *different* account and assert 404.
 * The API returns 404 (not 403) to avoid revealing resource existence.
 */
export async function assertIdorRejected(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  crossAccountHeaders: Record<string, string>,
  body?: unknown,
): Promise<APIResponse> {
  const opts: { headers: Record<string, string>; data?: unknown } = {
    headers: { ...crossAccountHeaders, "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.data = body;

  const res = await makeRequest(request, method, path, opts);
  expect(res.status()).toBe(HTTP_NOT_FOUND);
  await assertErrorShape(res);
  return res;
}

// ── Pagination ──────────────────────────────────────────────────────

/**
 * Create multiple items, then verify cursor pagination works:
 * - First page returns items + hasMore + nextCursor
 * - Following cursor returns remaining items
 */
export async function assertPaginates(
  request: APIRequestContext,
  listPath: string,
  headers: AuthHeaders,
  createFn: () => Promise<void>,
  opts: { itemCount?: number; pageSize?: number } = {},
): Promise<void> {
  const { itemCount = DEFAULT_PAGINATION_ITEM_COUNT, pageSize = DEFAULT_PAGINATION_PAGE_SIZE } =
    opts;

  for (let i = 0; i < itemCount; i++) {
    await createFn();
  }

  // First page
  const firstPage = await request.get(`${listPath}?limit=${String(pageSize)}`, { headers });
  expect(firstPage.ok()).toBe(true);
  const firstBody = await parseJsonBody<{
    data: Array<{ id: string }>;
    hasMore: boolean;
    nextCursor: string | null;
  }>(firstPage);
  expect(firstBody.data.length).toBe(pageSize);
  expect(firstBody.hasMore).toBe(true);
  expect(firstBody.nextCursor).toBeTruthy();

  // Second page via cursor
  const secondPage = await request.get(
    `${listPath}?limit=${String(pageSize)}&cursor=${firstBody.nextCursor as string}`,
    { headers },
  );
  expect(secondPage.ok()).toBe(true);
  const secondBody = await parseJsonBody<{
    data: Array<{ id: string }>;
    hasMore: boolean;
  }>(secondPage);
  expect(secondBody.data.length).toBeGreaterThanOrEqual(1);

  // Verify pages contain unique items (no overlap)
  const firstIds = firstBody.data.map((d) => d.id);
  const secondIds = secondBody.data.map((d) => d.id);
  const overlap = firstIds.filter((id) => secondIds.includes(id));
  expect(overlap).toEqual([]);
}

/**
 * Assert a list endpoint returns an empty result set.
 */
export async function assertEmptyList(
  request: APIRequestContext,
  listPath: string,
  headers: AuthHeaders,
): Promise<void> {
  const res = await request.get(listPath, { headers });
  expect(res.ok()).toBe(true);
  const body = await parseJsonBody<{ data: unknown[]; hasMore: boolean }>(res);
  expect(body.data).toEqual([]);
  expect(body.hasMore).toBe(false);
}

// ── Validation Rejection ────────────────────────────────────────────

/**
 * Send bad payloads to an endpoint and assert 400 or 422 rejection.
 */
export async function assertValidationRejects(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  headers: AuthHeaders,
  badPayloads: unknown[],
): Promise<void> {
  for (const payload of badPayloads) {
    const opts = {
      headers: { ...headers, "Content-Type": "application/json" },
      data: payload,
    };
    const res = await makeRequest(request, method, path, opts);
    const status = res.status();
    expect(
      status === HTTP_BAD_REQUEST || status === HTTP_UNPROCESSABLE,
      `Expected 400 or 422 for payload ${JSON.stringify(payload)}, got ${String(status)}`,
    ).toBe(true);
    await assertErrorShape(res);
  }
}

// ── HAS_DEPENDENTS Guard ────────────────────────────────────────────

/**
 * Attempt to delete an entity that has dependents and assert 409 HAS_DEPENDENTS.
 */
export async function assertHasDependentsGuard(
  request: APIRequestContext,
  deletePath: string,
  headers: AuthHeaders,
): Promise<APIResponse> {
  const res = await request.delete(deletePath, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(HTTP_CONFLICT);
  await assertErrorShape(res);
  const body = await parseJsonBody<{ error: { code: string } }>(res);
  expect(body.error.code).toBe("HAS_DEPENDENTS");
  return res;
}

// ── Rate Limit ──────────────────────────────────────────────────────

/**
 * Assert that an endpoint returns 429 after exceeding the rate limit.
 * Intended for slow test suite only.
 */
export async function assertRateLimited(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  headers: AuthHeaders,
  opts: { burstCount: number; body?: unknown },
): Promise<APIResponse> {
  const reqOpts: { headers: Record<string, string>; data?: unknown } = {
    headers: { ...headers, "Content-Type": "application/json" },
  };
  if (opts.body !== undefined) reqOpts.data = opts.body;

  // Exhaust the rate limit
  for (let i = 0; i < opts.burstCount; i++) {
    await makeRequest(request, method, path, reqOpts);
  }

  // Next request should be rate limited
  const res = await makeRequest(request, method, path, reqOpts);
  expect(res.status()).toBe(HTTP_TOO_MANY_REQUESTS);
  await assertErrorShape(res);
  return res;
}

// ── Internal ────────────────────────────────────────────────────────

async function makeRequest(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  opts: { headers: Record<string, string>; data?: unknown },
): Promise<APIResponse> {
  switch (method) {
    case "GET":
      return request.get(path, { headers: opts.headers });
    case "POST":
      return request.post(path, { headers: opts.headers, data: opts.data });
    case "PUT":
      return request.put(path, { headers: opts.headers, data: opts.data });
    case "PATCH":
      return request.patch(path, { headers: opts.headers, data: opts.data });
    case "DELETE":
      return request.delete(path, { headers: opts.headers, data: opts.data });
  }
}
