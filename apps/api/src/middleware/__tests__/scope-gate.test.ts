import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { errorHandler } from "../error-handler.js";
import { scopeGateMiddleware } from "../scope-gate.js";

import type { AuthContext, AuthEnv, SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, SessionId, SystemId } from "@pluralscape/types";

const TEST_ACCOUNT_ID = "acc_test" as AccountId;
const TEST_SYSTEM_ID = "sys_test" as SystemId;
const TEST_SESSION_ID = "ses_test" as SessionId;
const TEST_KEY_ID = "ak_test" as ApiKeyId;

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

  // Registered route — "GET /systems/:systemId/members/:memberId" is in scope registry
  const child = new Hono<AuthEnv>();
  child.get("/:memberId", (c) => c.json({ ok: true }));
  app.route("/systems/:systemId/members", child);

  // Unregistered route — no scope registry entry exists
  const unregistered = new Hono<AuthEnv>();
  unregistered.get("/", (c) => c.json({ secret: true }));
  app.route("/systems/:systemId/secret-stuff", unregistered);

  return app;
}

describe("scopeGateMiddleware (REST)", () => {
  it("passes through for session auth on registered route", async () => {
    const app = createTestApp(sessionAuth);
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("passes through for session auth on unregistered route", async () => {
    const app = createTestApp(sessionAuth);
    const res = await app.request("/systems/sys_123/secret-stuff");
    expect(res.status).toBe(200);
  });

  it("passes through for API key with matching scope on registered route", async () => {
    const app = createTestApp(apiKeyAuth(["read:members"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("returns 403 for API key with insufficient scope on registered route", async () => {
    const app = createTestApp(apiKeyAuth(["write:groups"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("read:members");
  });

  it("returns 403 for API key on unregistered route (fail-closed)", async () => {
    const app = createTestApp(apiKeyAuth(["full"]));
    const res = await app.request("/systems/sys_123/secret-stuff");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("not available for API key access");
  });

  it("passes through for API key with full scope on registered route", async () => {
    const app = createTestApp(apiKeyAuth(["full"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("passes through for API key with higher-tier scope", async () => {
    const app = createTestApp(apiKeyAuth(["write:members"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });

  it("passes through for API key with aggregate scope", async () => {
    const app = createTestApp(apiKeyAuth(["read-all"]));
    const res = await app.request("/systems/sys_123/members/mem_456");
    expect(res.status).toBe(200);
  });
});
