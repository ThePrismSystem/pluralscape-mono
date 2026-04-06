import { TRPCError } from "@trpc/server";

import { SCOPE_REGISTRY } from "../../lib/scope-registry.js";
import { hasScope } from "../../lib/scope.js";
import { middleware } from "../trpc.js";

/**
 * Global tRPC middleware that enforces API key scope via the central registry.
 *
 * - No auth context (public procedure): passes through.
 * - Session auth: always passes through.
 * - API key auth: looks up the procedure path in SCOPE_REGISTRY.trpc.
 *   - Entry found: checks hasScope(auth, entry.scope).
 *   - Entry missing: rejects with FORBIDDEN (fail-closed).
 */
export const scopeGateMiddleware = middleware(async ({ ctx, path, next }) => {
  if (!ctx.auth) return next();
  if (ctx.auth.authMethod === "session") return next();

  const entry = SCOPE_REGISTRY.trpc.get(path);
  if (!entry) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This procedure is not available for API key access",
    });
  }

  if (!hasScope(ctx.auth, entry.scope)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Insufficient scope: requires ${entry.scope}`,
    });
  }

  return next();
});
