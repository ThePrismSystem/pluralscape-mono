import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { systemProcedure } from "../../../trpc/middlewares/system.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { SystemId } from "@pluralscape/types";

const OWNED_SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const OTHER_SYSTEM_ID = "sys_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemId;

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: OWNED_SYSTEM_ID as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([OWNED_SYSTEM_ID]),
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
  echo: systemProcedure.input(z.object({ value: z.string() })).query(({ ctx, input }) => ({
    systemId: ctx.systemId,
    value: input.value,
  })),
});

const createCaller = createCallerFactory(testRouter);

describe("systemProcedure", () => {
  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(makeContext(null));
    await expect(caller.echo({ systemId: OWNED_SYSTEM_ID, value: "test" })).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("rejects requests with unowned systemId", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    await expect(caller.echo({ systemId: OTHER_SYSTEM_ID, value: "test" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });

  it("rejects requests with missing systemId", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    await expect(caller.echo({ value: "test" } as never)).rejects.toThrow();
  });

  it("passes valid systemId into context", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    const result = await caller.echo({ systemId: OWNED_SYSTEM_ID, value: "hello" });
    expect(result).toEqual({ systemId: OWNED_SYSTEM_ID, value: "hello" });
  });
});
