import { HTTP_FORBIDDEN } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { hasScope } from "../lib/scope.js";

import type { AuthEnv } from "../lib/auth-context.js";
import type { RequiredScope } from "@pluralscape/types";
import type { MiddlewareHandler } from "hono";

/**
 * Hono middleware that enforces an API key scope on the current request.
 *
 * Session auth is always allowed (hasScope returns true).
 * API key auth must include the required scope or a higher-privilege scope.
 */
export function requireScopeMiddleware(scope: RequiredScope): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const auth = c.get("auth");
    if (!hasScope(auth, scope)) {
      throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", `Insufficient scope: requires ${scope}`);
    }
    return next();
  };
}
