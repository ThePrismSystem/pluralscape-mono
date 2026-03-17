import { sessions } from "@pluralscape/db/pg";
import { LAST_ACTIVE_THROTTLE_MS, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { ApiHttpError } from "../lib/api-error.js";
import { getDb } from "../lib/db.js";
import { validateSession } from "../lib/session-auth.js";
import { HTTP_UNAUTHORIZED } from "../routes/auth/auth.constants.js";

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
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Authorization header required");
    }

    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!match?.[1]) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid authorization format");
    }

    const token = match[1];
    const db = await getDb();
    const result = await validateSession(db, token);

    if (!result.ok) {
      const code = result.error === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "UNAUTHENTICATED";
      const message =
        result.error === "SESSION_EXPIRED" ? "Session expired" : "Invalid or revoked session";
      throw new ApiHttpError(HTTP_UNAUTHORIZED, code, message);
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
          console.error("[auth] Failed to update session lastActive:", err);
        });
    }

    c.set("auth", result.auth);
    await next();
  };
}
