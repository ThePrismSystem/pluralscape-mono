import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { requireScopeMiddleware } from "../../middleware/scope.js";

import type { AuthContext, AuthEnv, SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, SessionId, SystemId } from "@pluralscape/types";

const TEST_ACCOUNT_ID = "acc_test" as AccountId;
const TEST_SYSTEM_ID = "sys_test" as SystemId;
const TEST_SESSION_ID = "ses_test" as SessionId;
const TEST_KEY_ID = "ak_test" as ApiKeyId;

/** Minimal session auth context for testing. */
const sessionAuth: SessionAuthContext = {
  authMethod: "session",
  accountId: TEST_ACCOUNT_ID,
  systemId: TEST_SYSTEM_ID,
  accountType: "system",
  ownedSystemIds: new Set([TEST_SYSTEM_ID]),
  auditLogIpTracking: false,
  sessionId: TEST_SESSION_ID,
};

/** Build an API key auth context with specific scopes. */
function apiKeyAuth(scopes: readonly ApiKeyScope[]): AuthContext {
  return {
    authMethod: "apiKey",
    accountId: TEST_ACCOUNT_ID,
    systemId: TEST_SYSTEM_ID,
    accountType: "system",
    ownedSystemIds: new Set([TEST_SYSTEM_ID]),
    auditLogIpTracking: false,
    keyId: TEST_KEY_ID,
    apiKeyScopes: scopes,
  };
}

/**
 * Create a Hono app that injects the given auth, applies scope middleware,
 * and uses the real error handler for structured JSON error responses.
 */
function createTestApp(auth: AuthContext, scope: Parameters<typeof requireScopeMiddleware>[0]) {
  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    return next();
  });
  app.use("*", requireScopeMiddleware(scope));
  app.get("/resource", (c) => c.json({ ok: true }));
  app.post("/resource", (c) => c.json({ created: true }, 201));
  return app;
}

describe("scope enforcement integration", () => {
  it("allows API key with matching scope", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]), "read:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects API key with insufficient scope (403)", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]), "write:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toContain("write:members");
  });

  it("allows higher-tier scope (write satisfies read)", async () => {
    const app = createTestApp(apiKeyAuth(["write:members"]), "read:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(200);
  });

  it("allows full scope for any endpoint", async () => {
    const app = createTestApp(apiKeyAuth(["full"]), "delete:groups");
    const res = await app.request("/resource");
    expect(res.status).toBe(200);
  });

  it("allows session auth for any scope", async () => {
    const app = createTestApp(sessionAuth, "delete:system");
    const res = await app.request("/resource");
    expect(res.status).toBe(200);
  });

  it("rejects empty scopes", async () => {
    const app = createTestApp(apiKeyAuth([]), "read:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(403);
  });

  it("allows aggregate scope (read-all satisfies read:members)", async () => {
    const app = createTestApp(apiKeyAuth(["read-all"]), "read:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(200);
  });

  it("rejects aggregate scope that is insufficient (read-all for write:members)", async () => {
    const app = createTestApp(apiKeyAuth(["read-all"]), "write:members");
    const res = await app.request("/resource");
    expect(res.status).toBe(403);
  });
});
