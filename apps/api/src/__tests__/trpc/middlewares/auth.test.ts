import { describe, expect, it } from "vitest";

import { protectedProcedure } from "../../../trpc/middlewares/auth.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { SystemId } from "@pluralscape/types";

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set(["sys_550e8400-e29b-41d4-a716-446655440000" as SystemId]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

const testRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ({
    accountId: ctx.auth.accountId,
  })),
});

const createCaller = createCallerFactory(testRouter);

describe("protectedProcedure", () => {
  it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
    const caller = createCaller(makeContext(null));
    await expect(caller.whoami()).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("allows authenticated requests and narrows auth to non-null", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    const result = await caller.whoami();
    expect(result).toEqual({ accountId: MOCK_AUTH.accountId });
  });
});
