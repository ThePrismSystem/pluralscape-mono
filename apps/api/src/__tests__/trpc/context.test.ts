import { describe, expect, it, vi } from "vitest";

import type { AuthContext, SessionAuthContext } from "../../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({ __mock: "db" }),
}));

vi.mock("../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(() => Promise.resolve()),
}));

vi.mock("../../lib/request-meta.js", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: "1.2.3.4", userAgent: "test-agent" }),
}));

const { createAuditWriter } = await import("../../lib/audit-writer.js");
const { createTRPCContext } = await import("../../trpc/context.js");

const MOCK_AUTH: SessionAuthContext = {
  authMethod: "session" as const,
  accountId: "acct_ctx001" as AccountId,
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId,
  sessionId: "sess_ctx001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set(["sys_550e8400-e29b-41d4-a716-446655440000" as SystemId]),
  auditLogIpTracking: false,
};

function mockHonoContext(auth?: AuthContext): Record<string, unknown> {
  return {
    get: vi.fn((key: string) => (key === "auth" ? auth : undefined)),
    req: { raw: new Request("http://localhost/v1/trpc/test") },
  };
}

describe("createTRPCContext", () => {
  it("sets auth from Hono context when present", async () => {
    const c = mockHonoContext(MOCK_AUTH);
    const ctx = await createTRPCContext(c as never);
    expect(ctx.auth).toBe(MOCK_AUTH);
  });

  it("sets auth to null when Hono context has no auth", async () => {
    const c = mockHonoContext(undefined);
    const ctx = await createTRPCContext(c as never);
    expect(ctx.auth).toBeNull();
  });

  it("provides a db handle from getDb()", async () => {
    const c = mockHonoContext();
    const ctx = await createTRPCContext(c as never);
    expect(ctx.db).toEqual({ __mock: "db" });
  });

  it("provides request metadata", async () => {
    const c = mockHonoContext();
    const ctx = await createTRPCContext(c as never);
    expect(ctx.requestMeta).toEqual({ ipAddress: "1.2.3.4", userAgent: "test-agent" });
  });

  it("createAudit() with no args passes request auth to createAuditWriter", async () => {
    const c = mockHonoContext(MOCK_AUTH);
    const ctx = await createTRPCContext(c as never);
    ctx.createAudit();
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(c, MOCK_AUTH);
  });

  it("createAudit(null) passes null, not request auth", async () => {
    const c = mockHonoContext(MOCK_AUTH);
    const ctx = await createTRPCContext(c as never);
    ctx.createAudit(null);
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(c, null);
  });

  it("createAudit(otherAuth) passes the override auth", async () => {
    const otherAuth = { ...MOCK_AUTH, accountId: "acct_other" as AuthContext["accountId"] };
    const c = mockHonoContext(MOCK_AUTH);
    const ctx = await createTRPCContext(c as never);
    ctx.createAudit(otherAuth);
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(c, otherAuth);
  });
});
