import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../error-handler.js";
import { requireScopeMiddleware } from "../scope.js";

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

/** Create a minimal Hono app with auth set, scope middleware, and a stub handler. */
function createTestApp(auth: AuthContext, scope: Parameters<typeof requireScopeMiddleware>[0]) {
  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    return next();
  });
  app.use("*", requireScopeMiddleware(scope));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("requireScopeMiddleware", () => {
  it("passes through for session auth", async () => {
    const app = createTestApp(sessionAuth, "read:members");
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("passes through when API key has matching scope", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]), "read:members");
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("passes through when API key has higher-tier scope", async () => {
    const app = createTestApp(apiKeyAuth(["write:members"]), "read:members");
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("passes through when API key has full scope", async () => {
    const app = createTestApp(apiKeyAuth(["full"]), "write:groups");
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("returns 403 when API key lacks required scope", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]), "write:members");
    const res = await app.request("/test");
    expect(res.status).toBe(403);
  });

  it("returns 403 with scope name in error message", async () => {
    const app = createTestApp(apiKeyAuth(["read:groups"]), "delete:members");
    const res = await app.request("/test");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("delete:members");
  });
});
