import { createCallerFactory, router } from "../../trpc/trpc.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { TRPCContext } from "../../trpc/context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

export type { SystemId };

export const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;

export const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AccountId,
  systemId: SYSTEM_ID,
  sessionId: "sess_test001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

export const noopAuditWriter: AuditWriter = () => Promise.resolve();

export function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

export function makeCallerFactory<T extends Parameters<typeof router>[0]>(
  routerDef: T,
): (
  auth?: AuthContext | null,
) => ReturnType<ReturnType<typeof createCallerFactory<ReturnType<typeof router<T>>>>> {
  const appRouter = router(routerDef);
  const createCaller = createCallerFactory(appRouter);
  return (auth: AuthContext | null = MOCK_AUTH) => createCaller(makeContext(auth));
}
