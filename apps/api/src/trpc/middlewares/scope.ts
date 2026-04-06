import { TRPCError } from "@trpc/server";

import { hasScope } from "../../lib/scope.js";
import { middleware } from "../trpc.js";

import type { TRPCContext } from "../context.js";
import type { RequiredScope } from "@pluralscape/types";
import type { TRPCMiddlewareBuilder } from "@trpc/server";

/**
 * tRPC middleware factory that enforces an API key scope.
 *
 * Session auth is always allowed (hasScope returns true).
 * API key auth must include the required scope or a higher-privilege scope.
 */
export function requireScope(
  scope: RequiredScope,
): TRPCMiddlewareBuilder<TRPCContext, object, object, unknown> {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.auth) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }
    if (!hasScope(ctx.auth, scope)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient scope: requires ${scope}`,
      });
    }
    return next();
  });
}
