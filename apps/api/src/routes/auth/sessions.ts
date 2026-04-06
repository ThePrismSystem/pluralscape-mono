import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_NO_CONTENT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { requireSession } from "../../lib/auth-context.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { envelope } from "../../lib/response.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  listSessions,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";

import { DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT } from "./auth.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const sessionsRoute = new Hono<AuthEnv>();

sessionsRoute.use("*", createCategoryRateLimiter("authLight"));

// All routes in this router require authentication
sessionsRoute.use("*", authMiddleware());

// GET /auth/sessions — list active sessions for the current account
sessionsRoute.get("/sessions", async (c) => {
  const auth = c.get("auth");
  const db = await getDb();
  const cursor = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const limit = parsePaginationLimit(limitParam, DEFAULT_SESSION_LIMIT, MAX_SESSION_LIMIT);

  const result = await listSessions(db, auth.accountId, parseCursor(cursor), limit);
  return c.json(envelope(result));
});

// DELETE /auth/sessions/:id — revoke a specific session
sessionsRoute.delete("/sessions/:id", async (c) => {
  const auth = c.get("auth");
  const session = requireSession(auth);
  const db = await getDb();
  const targetId = parseIdParam(c.req.param("id"), "sess_");

  // Cannot revoke current session via this endpoint — use POST /auth/logout
  if (targetId === session.sessionId) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Use POST /auth/logout to revoke the current session",
    );
  }

  const audit = createAuditWriter(c, auth);

  const success = await revokeSession(db, targetId, auth.accountId, audit);
  if (!success) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Session not found");
  }

  return c.body(null, HTTP_NO_CONTENT);
});

// POST /auth/logout — revoke the current session
sessionsRoute.post("/logout", async (c) => {
  const auth = c.get("auth");
  const session = requireSession(auth);
  const db = await getDb();
  const audit = createAuditWriter(c, auth);

  await logoutCurrentSession(db, session.sessionId, auth.accountId, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

// POST /auth/sessions/revoke-all — revoke all sessions except current
sessionsRoute.post("/sessions/revoke-all", async (c) => {
  const auth = c.get("auth");
  const session = requireSession(auth);
  const db = await getDb();
  const audit = createAuditWriter(c, auth);

  const count = await revokeAllSessions(db, auth.accountId, session.sessionId, audit);
  return c.json(envelope({ revokedCount: count }));
});
