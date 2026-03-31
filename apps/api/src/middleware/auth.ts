import { sessions } from "@pluralscape/db/pg";
import { LAST_ACTIVE_THROTTLE_MS, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { getDb } from "../lib/db.js";
import { getContextLogger } from "../lib/logger.js";
import { validateSession } from "../lib/session-auth.js";

import { SESSION_TOKEN_PATTERN } from "./middleware.constants.js";

import type { AuthEnv } from "../lib/auth-context.js";
import type { MiddlewareHandler } from "hono";

/**
 * Authentication middleware that validates session tokens.
 *
 * Extracts Bearer token from Authorization header, validates the session,
 * and sets the auth context on the Hono context. Also throttles lastActive
 * updates to avoid write amplification.
 */
export function authMiddleware(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const log = getContextLogger(c);
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Authorization header required");
    }

    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!match?.[1]) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid authorization format");
    }

    const token = match[1];

    if (!SESSION_TOKEN_PATTERN.test(token)) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid or revoked session");
    }

    const db = await getDb();
    const result = await validateSession(db, token);

    if (!result.ok) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Authentication required");
    }

    // Throttle lastActive updates: only update if stale > LAST_ACTIVE_THROTTLE_MS
    const currentTime = now();
    if (
      result.session.lastActive === null ||
      currentTime - result.session.lastActive > LAST_ACTIVE_THROTTLE_MS
    ) {
      // Fire-and-forget update — don't block the request
      void db
        .update(sessions)
        .set({ lastActive: currentTime })
        .where(eq(sessions.id, result.session.id))
        .then(() => {})
        .catch((err: unknown) => {
          log.error(
            "Failed to update session lastActive",
            err instanceof Error ? { err } : { error: String(err) },
          );
        });
    }

    c.set("auth", result.auth);
    await next();
  };
}
