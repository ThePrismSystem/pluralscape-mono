import { describe, expect, it } from "vitest";

import { noopAuditWriter } from "../../../__tests__/trpc/test-helpers.js";
import { createCallerFactory, publicProcedure, router } from "../../trpc.js";
import { requireScope } from "../scope.js";

import type { ApiKeyAuthContext, AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../context.js";
import type {
  AccountId,
  ApiKeyId,
  ApiKeyScope,
  RequiredScope,
  SessionId,
  SystemId,
} from "@pluralscape/types";

const TEST_SYSTEM_ID = "sys_test" as SystemId;

/** Minimal session auth context for testing. */
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

/** Create a test router with a single procedure protected by requireScope. */
function createTestCaller(auth: AuthContext | null, scope: RequiredScope) {
  const testRouter = router({
    test: publicProcedure.use(requireScope(scope)).query(() => ({ ok: true })),
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

describe("requireScope (tRPC middleware)", () => {
  it("throws UNAUTHORIZED when auth is null", async () => {
    const caller = createTestCaller(null, "read:members");
    await expect(caller.test()).rejects.toThrow(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      }),
    );
  });

  it("throws FORBIDDEN when API key lacks required scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["read:members"]), "write:members");
    await expect(caller.test()).rejects.toThrow(
      expect.objectContaining({
        code: "FORBIDDEN",
        message: expect.stringContaining("write:members"),
      }),
    );
  });

  it("passes through for session auth", async () => {
    const caller = createTestCaller(sessionAuth, "delete:groups");
    const result = await caller.test();
    expect(result).toEqual({ ok: true });
  });

  it("passes through when API key has matching scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["read:members"]), "read:members");
    const result = await caller.test();
    expect(result).toEqual({ ok: true });
  });

  it("passes through when API key has higher-tier scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["delete:members"]), "read:members");
    const result = await caller.test();
    expect(result).toEqual({ ok: true });
  });

  it("passes through when API key has full scope", async () => {
    const caller = createTestCaller(apiKeyAuth(["full"]), "write:system");
    const result = await caller.test();
    expect(result).toEqual({ ok: true });
  });
});
