import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";

import { IDEMPOTENCY_KEY_HEADER } from "../../middleware/idempotency.constants.js";
import { createIdempotencyMiddleware, setIdempotencyStore } from "../../middleware/idempotency.js";
import { MemoryIdempotencyStore } from "../../middleware/stores/memory-idempotency-store.js";

import type { AuthEnv } from "../../lib/auth-context.js";

describe("idempotency middleware", () => {
  let store: MemoryIdempotencyStore;
  let callCount: number;
  let app: Hono<AuthEnv>;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
    setIdempotencyStore(store);
    callCount = 0;

    app = new Hono<AuthEnv>();
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
});
