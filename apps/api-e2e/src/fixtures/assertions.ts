/**
 * Shared assertion helpers for cross-cutting E2E test concerns.
 *
 * Each helper makes a request and asserts the expected error behavior.
 * All error assertions also verify the standard error envelope shape.
 */
import { expect } from "@playwright/test";

import type { APIRequestContext, APIResponse } from "@playwright/test";

// ── Constants ────────────────────────────────────────────────────────

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const HTTP_TOO_MANY_REQUESTS = 429;

/** Default number of items to create when testing pagination. */
const DEFAULT_PAGINATION_ITEM_COUNT = 3;

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// ── Error Shape ─────────────────────────────────────────────────────

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
  expect(typeof (body as { error: { code: string } }).error.code).toBe("string");
  expect(typeof (body as { error: { message: string } }).error.message).toBe("string");
  expect(typeof (body as { requestId: string }).requestId).toBe("string");

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
  headers: Record<string, string>,
  createFn: () => Promise<void>,
  opts: { itemCount?: number; pageSize?: number } = {},
): Promise<void> {
  const { itemCount = DEFAULT_PAGINATION_ITEM_COUNT, pageSize = 2 } = opts;

  // Create items
  for (let i = 0; i < itemCount; i++) {
    await createFn();
  }

  // First page
  const firstPage = await request.get(`${listPath}?limit=${String(pageSize)}`, { headers });
  expect(firstPage.ok()).toBe(true);
  const firstBody = (await firstPage.json()) as {
    data: unknown[];
    hasMore: boolean;
    nextCursor: string | null;
  };
  expect(firstBody.data.length).toBe(pageSize);
  expect(firstBody.hasMore).toBe(true);
  expect(firstBody.nextCursor).toBeTruthy();

  // Second page via cursor
  const secondPage = await request.get(
    `${listPath}?limit=${String(pageSize)}&cursor=${firstBody.nextCursor as string}`,
    { headers },
  );
  expect(secondPage.ok()).toBe(true);
  const secondBody = (await secondPage.json()) as {
    data: unknown[];
    hasMore: boolean;
  };
  expect(secondBody.data.length).toBeGreaterThanOrEqual(1);
}

// ── Validation Rejection ────────────────────────────────────────────

/**
 * Send bad payloads to an endpoint and assert 400 or 422 rejection.
 */
export async function assertValidationRejects(
  request: APIRequestContext,
  method: HttpMethod,
  path: string,
  headers: Record<string, string>,
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
  headers: Record<string, string>,
): Promise<APIResponse> {
  const res = await request.delete(deletePath, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(HTTP_CONFLICT);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe("HAS_DEPENDENTS");
  await assertErrorShape(res);
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
  headers: Record<string, string>,
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
    case "DELETE":
      return request.delete(path, { headers: opts.headers, data: opts.data });
  }
}
