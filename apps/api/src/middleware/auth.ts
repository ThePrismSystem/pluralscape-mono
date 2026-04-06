import { apiKeys, sessions } from "@pluralscape/db/pg";
import { LAST_ACTIVE_THROTTLE_MS, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { HTTP_UNAUTHORIZED } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { getDb } from "../lib/db.js";
import { getContextLogger } from "../lib/logger.js";
import { validateSession } from "../lib/session-auth.js";
import { validateApiKey } from "../services/api-key.service.js";

import { API_KEY_TOKEN_PATTERN, SESSION_TOKEN_PATTERN } from "./middleware.constants.js";

import type { AuthEnv } from "../lib/auth-context.js";
import type { SessionId, SystemId } from "@pluralscape/types";
import type { MiddlewareHandler } from "hono";

/**
 * Authentication middleware that validates session tokens and API keys.
 *
 * Extracts Bearer token from Authorization header, detects token type by format
 * (ps_ prefix = API key, 64-char hex = session), validates accordingly,
 * and sets the auth context on the Hono context.
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
    const db = await getDb();

    // ── API key path ──────────────────────────────────────────────
    if (API_KEY_TOKEN_PATTERN.test(token)) {
      const result = await validateApiKey(db, token);
      if (!result) {
        throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid or revoked API key");
      }

      // Fire-and-forget lastUsedAt update
      const currentTime = now();
      void db
        .update(apiKeys)
        .set({ lastUsedAt: currentTime })
        .where(eq(apiKeys.id, result.keyId))
        .then(() => {})
        .catch((err: unknown) => {
          log.error(
            "Failed to update API key lastUsedAt",
            err instanceof Error ? { err } : { error: String(err) },
          );
        });

      c.set("auth", {
        accountId: result.accountId,
        systemId: result.systemId,
        sessionId: result.keyId as string as SessionId,
        accountType: "system" as const,
        ownedSystemIds: new Set<SystemId>([result.systemId]),
        auditLogIpTracking: result.auditLogIpTracking,
        apiKeyScopes: result.scopes,
      });

      return next();
    }

    // ── Session token path ────────────────────────────────────────
    if (!SESSION_TOKEN_PATTERN.test(token)) {
      throw new ApiHttpError(HTTP_UNAUTHORIZED, "UNAUTHENTICATED", "Invalid or revoked session");
    }

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
