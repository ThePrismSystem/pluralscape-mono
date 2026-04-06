import { describe, expect, it } from "vitest";

import { noopAuditWriter } from "../../../__tests__/trpc/test-helpers.js";
import { createCallerFactory, publicProcedure, router } from "../../trpc.js";
import { scopeGateMiddleware } from "../scope-gate.js";

import type { ApiKeyAuthContext, AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../context.js";
import type { AccountId, ApiKeyId, ApiKeyScope, SessionId, SystemId } from "@pluralscape/types";

const TEST_SYSTEM_ID = "sys_test" as SystemId;

const sessionAuth: AuthContext = {
  authMethod: "session",
  accountId: "acc_test" as AccountId,
  systemId: TEST_SYSTEM_ID,
  accountType: "system",
  ownedSystemIds: new Set([TEST_SYSTEM_ID]),
  auditLogIpTracking: false,
  sessionId: "ses_test" as SessionId,
};

function apiKeyAuth(scopes: readonly ApiKeyScope[]): ApiKeyAuthContext {
  return {
    authMethod: "apiKey",
    accountId: "acc_test" as AccountId,
    systemId: TEST_SYSTEM_ID,
    accountType: "system",
    ownedSystemIds: new Set([TEST_SYSTEM_ID]),
    auditLogIpTracking: false,
    keyId: "ak_test" as ApiKeyId,
    apiKeyScopes: scopes,
  };
}

function createTestCaller(auth: AuthContext | null) {
  // "member.get" is in the registry with scope "read:members"
  // "unregistered.procedure" is NOT in the registry
  const testRouter = router({
    member: router({
      get: publicProcedure.use(scopeGateMiddleware).query(() => ({ ok: true })),
    }),
    unregistered: router({
      procedure: publicProcedure.use(scopeGateMiddleware).query(() => ({ secret: true })),
    }),
  });
  const createCaller = createCallerFactory(testRouter);
  return createCaller({
    db: new Proxy({} as TRPCContext["db"], {
      get(_, prop) {
        throw new Error(`Test tried to access db.${String(prop)}`);
      },
    }),
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  });
}

describe("scopeGateMiddleware (tRPC)", () => {
  it("passes through when auth is null (public procedure)", async () => {
    const caller = createTestCaller(null);
    const result = await caller.member.get();
    expect(result).toEqual({ ok: true });
  });

  it("passes through for session auth on registered procedure", async () => {
    const caller = createTestCaller(sessionAuth);
    const result = await caller.member.get();
    expect(result).toEqual({ ok: true });
  });

  it("passes through for session auth on unregistered procedure", async () => {
    const caller = createTestCaller(sessionAuth);
    const result = await caller.unregistered.procedure();
    expect(result).toEqual({ secret: true });
  });

  it("passes through for API key with matching scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["read:members"]));
    const result = await caller.member.get();
    expect(result).toEqual({ ok: true });
  });

  it("throws FORBIDDEN for API key with insufficient scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["write:groups"]));
    await expect(caller.member.get()).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: expect.stringContaining("read:members"),
      }),
    );
  });

  it("throws FORBIDDEN for API key on unregistered procedure (fail-closed)", async () => {
    const caller = createTestCaller(apiKeyAuth(["full"]));
    await expect(caller.unregistered.procedure()).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: expect.stringContaining("not available for API key access"),
      }),
    );
  });

  it("passes through for API key with full scope on registered procedure", async () => {
    const caller = createTestCaller(apiKeyAuth(["full"]));
    const result = await caller.member.get();
    expect(result).toEqual({ ok: true });
  });

  it("passes through for API key with higher-tier scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["write:members"]));
    const result = await caller.member.get();
    expect(result).toEqual({ ok: true });
  });
});
