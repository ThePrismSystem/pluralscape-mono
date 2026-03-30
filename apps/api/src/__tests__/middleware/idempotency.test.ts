import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { IDEMPOTENCY_KEY_HEADER } from "../../middleware/idempotency.constants.js";
import {
  _resetIdempotencyStoreForTesting,
  createIdempotencyMiddleware,
  setIdempotencyStore,
} from "../../middleware/idempotency.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";
import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../lib/logger.js", () => {
  const instance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    logger: instance,
    createRequestLogger: () => instance,
    getContextLogger: () => instance,
  };
});

vi.mock("../../env.js", () => ({
  env: { NODE_ENV: "test" },
}));

describe("idempotency middleware", () => {
  let store: MemoryIdempotencyStore;
  let callCount: number;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
    setIdempotencyStore(store);
    callCount = 0;

    app = new Hono<AuthEnv>();
    app.use("*", requestIdMiddleware());
    app.use("*", (c, next) => {
      c.set("auth", {
        accountId: "acct-1" as never,
        systemId: null,
        sessionId: "sess-1" as never,
        accountType: "system" as never,
        ownedSystemIds: new Set(),
        auditLogIpTracking: false,
      });
      return next();
    });
    app.post("/items", createIdempotencyMiddleware(), (c) => {
      callCount++;
      return c.json({ data: { id: "new-item" } }, 201);
    });
    app.onError(errorHandler);
  });

  afterEach(() => {
    _resetIdempotencyStoreForTesting();
  });

  it("passes through when no idempotency header", async () => {
    const res = await app.request("/items", { method: "POST" });
    expect(res.status).toBe(201);
    expect(callCount).toBe(1);
  });

  it("executes handler on first request with idempotency key", async () => {
    const res = await app.request("/items", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "key-1" },
    });
    expect(res.status).toBe(201);
    expect(callCount).toBe(1);
  });

  it("returns cached response on duplicate idempotency key", async () => {
    const headers = { [IDEMPOTENCY_KEY_HEADER]: "key-2" };
    await app.request("/items", { method: "POST", headers });
    const res = await app.request("/items", { method: "POST", headers });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: { id: "new-item" } });
    expect(callCount).toBe(1);
  });

  it("rejects overly long idempotency key", async () => {
    const res = await app.request("/items", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "x".repeat(100) },
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when lock is already held", async () => {
    await store.acquireLock("acct-1", "conflict-key");

    const res = await app.request("/items", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "conflict-key" },
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("releases lock and does not cache when handler throws without error handler", async () => {
    const errApp = new Hono<AuthEnv>();
    errApp.use("*", requestIdMiddleware());
    errApp.use("*", (c, next) => {
      c.set("auth", {
        accountId: "acct-1" as never,
        systemId: null,
        sessionId: "sess-1" as never,
        accountType: "system" as never,
        ownedSystemIds: new Set(),
        auditLogIpTracking: false,
      });
      return next();
    });
    errApp.post("/fail", createIdempotencyMiddleware(), () => {
      throw new Error("handler boom");
    });
    // No error handler — error propagates through await next()

    const res = await errApp.request("/fail", {
      method: "POST",
      headers: { [IDEMPOTENCY_KEY_HEADER]: "err-key" },
    });

    expect(res.status).toBe(500);

    // Lock should be released — re-acquisition should succeed
    const reacquired = await store.acquireLock("acct-1", "err-key");
    expect(reacquired).toBe(true);

    // Error should NOT be cached (await next() threw, store.set() was skipped)
    const cached = await store.get("acct-1", "err-key");
    expect(cached).toBeNull();
  });

  it("skips idempotency when auth is absent", async () => {
    let noAuthCallCount = 0;
    const noAuthApp = new Hono();
    noAuthApp.use("*", requestIdMiddleware());
    // No auth middleware — c.get("auth") will be undefined
    noAuthApp.post("/open", createIdempotencyMiddleware(), (c) => {
      noAuthCallCount++;
      return c.json({ ok: true });
    });

    const headers = { [IDEMPOTENCY_KEY_HEADER]: "same-key" };
    await noAuthApp.request("/open", { method: "POST", headers });
    await noAuthApp.request("/open", { method: "POST", headers });

    // Handler runs twice — idempotency was skipped
    expect(noAuthCallCount).toBe(2);
  });
});
