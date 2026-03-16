import { Hono } from "hono";

import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  extractIpAddress,
  extractUserAgent,
  listSessions,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";

import { DEFAULT_SESSION_LIMIT, HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "./auth.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const sessionsRoute = new Hono<AuthEnv>();

sessionsRoute.use("*", createCategoryRateLimiter("authLight"));

// Apply auth middleware to all session management endpoints
sessionsRoute.use("/sessions", authMiddleware());
sessionsRoute.use("/sessions/*", authMiddleware());
sessionsRoute.use("/logout", authMiddleware());

// GET /auth/sessions — list active sessions for the current account
sessionsRoute.get("/sessions", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const cursor = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_SESSION_LIMIT;

  const result = await listSessions(db, auth.accountId as string, cursor, limit);
  return c.json(result);
});

// DELETE /auth/sessions/:id — revoke a specific session
sessionsRoute.delete("/sessions/:id", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const targetId = c.req.param("id");

  // Cannot revoke current session via this endpoint — use POST /auth/logout
  if (targetId === (auth.sessionId as string)) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Use POST /auth/logout to revoke the current session",
    );
  }

  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  const success = await revokeSession(db, targetId, auth.accountId as string, requestMeta);
  if (!success) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Session not found");
  }

  return c.json({ ok: true });
});

// POST /auth/logout — revoke the current session
sessionsRoute.post("/logout", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  await logoutCurrentSession(db, auth.sessionId as string, auth.accountId as string, requestMeta);
  return c.json({ ok: true });
});

// POST /auth/sessions/revoke-all — revoke all sessions except current
sessionsRoute.post("/sessions/revoke-all", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  const count = await revokeAllSessions(
    db,
    auth.accountId as string,
    auth.sessionId as string,
    requestMeta,
  );
  return c.json({ ok: true, revokedCount: count });
});
