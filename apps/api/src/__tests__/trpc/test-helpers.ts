import { expect, type MockInstance } from "vitest";

import { createTRPCContextInner } from "../../trpc/context.js";
import { createCallerFactory, router } from "../../trpc/trpc.js";
import { MOCK_AUTH, MOCK_SYSTEM_ID } from "../helpers/shared-mocks.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { TRPCContext } from "../../trpc/context.js";
import type { SystemId } from "@pluralscape/types";

export type { SystemId };

export { MOCK_AUTH, MOCK_SYSTEM_ID };

export const noopAuditWriter: AuditWriter = () => Promise.resolve();

export function makeContext(auth: AuthContext | null): TRPCContext {
  return createTRPCContextInner({
    db: new Proxy({} as TRPCContext["db"], {
      get(_, prop) {
        throw new Error(
          `Test tried to access db.${String(prop)} — use integration tests for DB access`,
        );
      },
    }),
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  });
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

/** Extract the rate-limit key from the first call to a mocked checkRateLimit. */
export function getRateLimitKey(mock: MockInstance): string {
  const key = mock.mock.calls[0]?.[0];
  if (typeof key !== "string") {
    throw new Error("checkRateLimit was not called or first arg is not a string");
  }
  return key;
}

/**
 * Assert that calling `fn` triggers rate limiting with the expected category.
 * Clears the mock before calling, then checks the rate-limit key contains the category.
 */
export async function assertProcedureRateLimited(
  checkRateLimitMock: MockInstance,
  fn: () => Promise<unknown>,
  expectedCategory: string,
): Promise<void> {
  checkRateLimitMock.mockClear();
  await fn();
  expect(checkRateLimitMock).toHaveBeenCalled();
  expect(getRateLimitKey(checkRateLimitMock)).toContain(expectedCategory);
}
