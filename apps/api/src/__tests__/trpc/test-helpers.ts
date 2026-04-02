import { createCallerFactory, router } from "../../trpc/trpc.js";
import { MOCK_AUTH, MOCK_SYSTEM_ID } from "../helpers/shared-mocks.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { TRPCContext } from "../../trpc/context.js";
import type { SystemId } from "@pluralscape/types";

export type { SystemId };

export { MOCK_AUTH, MOCK_SYSTEM_ID };

/** Backwards-compatible alias for MOCK_SYSTEM_ID. */
export const SYSTEM_ID = MOCK_SYSTEM_ID;

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
