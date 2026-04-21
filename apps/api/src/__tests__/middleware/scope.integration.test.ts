import { brandId } from "@pluralscape/types";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { scopeGateMiddleware } from "../../middleware/scope-gate.js";

import type { AuthContext, AuthEnv, SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, SessionId, SystemId } from "@pluralscape/types";

const TEST_ACCOUNT_ID = brandId<AccountId>("acc_test");
const TEST_SYSTEM_ID = brandId<SystemId>("sys_test");
const TEST_SESSION_ID = brandId<SessionId>("ses_test");
const TEST_KEY_ID = brandId<ApiKeyId>("ak_test");

const sessionAuth: SessionAuthContext = {
  authMethod: "session",
  accountId: TEST_ACCOUNT_ID,
  systemId: TEST_SYSTEM_ID,
  accountType: "system",
  ownedSystemIds: new Set([TEST_SYSTEM_ID]),
  auditLogIpTracking: false,
  sessionId: TEST_SESSION_ID,
};

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

function createTestApp(auth: AuthContext) {
  const app = new Hono<AuthEnv>();
  app.onError(errorHandler);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    return next();
  });
  app.use("*", scopeGateMiddleware());

  // Registered route (read:members in scope registry)
  const memberChild = new Hono<AuthEnv>();
  memberChild.get("/:memberId", (c) => c.json({ ok: true }));
  memberChild.post("/", (c) => c.json({ created: true }, 201));
  app.route("/systems/:systemId/members", memberChild);

  return app;
}

describe("scope gate integration", () => {
  it("allows API key with matching scope", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects API key with insufficient scope (403)", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]));
    const res = await app.request("/systems/sys_123/members", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("SCOPE_INSUFFICIENT");
    expect(body.error?.message).toContain("write:members");
  });

  it("allows higher-tier scope (write satisfies read)", async () => {
    const app = createTestApp(apiKeyAuth(["write:members"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("allows full scope for any endpoint", async () => {
    const app = createTestApp(apiKeyAuth(["full"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("allows session auth for any scope", async () => {
    const app = createTestApp(sessionAuth);
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("rejects empty scopes", async () => {
    const app = createTestApp(apiKeyAuth([]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(403);
  });

  it("allows aggregate scope (read-all satisfies read:members)", async () => {
    const app = createTestApp(apiKeyAuth(["read-all"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("rejects aggregate scope that is insufficient (read-all for write:members)", async () => {
    const app = createTestApp(apiKeyAuth(["read-all"]));
    const res = await app.request("/systems/sys_123/members", { method: "POST" });
    expect(res.status).toBe(403);
  });
});
