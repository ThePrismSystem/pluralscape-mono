import { matchedRoutes } from "hono/route";

import { HTTP_FORBIDDEN } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { SCOPE_REGISTRY } from "../lib/scope-registry.js";
import { hasScope } from "../lib/scope.js";

import type { AuthEnv } from "../lib/auth-context.js";
import type { Context, MiddlewareHandler } from "hono";

/**
 * Extract the route pattern from Hono's matched routes.
 * The last non-wildcard entry is the handler's full route pattern.
 */
function getRoutePattern(c: Context): string | null {
  const routes = matchedRoutes(c);
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i];
    if (route !== undefined && route.path !== "/*") return route.path;
  }
  return null;
}

/**
 * Global Hono middleware that enforces API key scope via the central registry.
 *
 * - Session auth: always passes through.
 * - API key auth: looks up the matched route pattern in SCOPE_REGISTRY.rest.
 *   - Entry found: checks hasScope(auth, entry.scope).
 *   - Entry missing: rejects with 403 (fail-closed).
 */
export function scopeGateMiddleware(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (auth.authMethod === "session") return next();

    const routePattern = getRoutePattern(c);
    if (!routePattern) {
      throw new ApiHttpError(
        HTTP_FORBIDDEN,
        "FORBIDDEN",
        "This endpoint is not available for API key access",
      );
    }

    const key = `${c.req.method} ${routePattern}`;
    const entry = SCOPE_REGISTRY.rest.get(key);

    if (!entry) {
      throw new ApiHttpError(
        HTTP_FORBIDDEN,
        "FORBIDDEN",
        "This endpoint is not available for API key access",
      );
    }

    if (!hasScope(auth, entry.scope)) {
      throw new ApiHttpError(
        HTTP_FORBIDDEN,
        "SCOPE_INSUFFICIENT",
        `Insufficient scope: requires ${entry.scope}`,
      );
    }

    return next();
  };
}
