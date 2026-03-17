import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/request-meta.js", () => ({
  extractIpAddress: vi.fn().mockReturnValue(null),
  extractUserAgent: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../services/auth.service.js", () => ({
  listSessions: vi.fn(),
  logoutCurrentSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../lib/session-auth.js", () => ({
  validateSession: vi.fn(),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(
      () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
          c.set("auth", {
            accountId: "acct_test",
            sessionId: "sess_current",
            systemId: null,
            accountType: "system",
          });
          await next();
        },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { listSessions, logoutCurrentSession, revokeSession, revokeAllSessions } =
  await import("../../../services/auth.service.js");
const { authMiddleware } = await import("../../../middleware/auth.js");
const { sessionsRoute } = await import("../../../routes/auth/sessions.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/auth", sessionsRoute);
  app.onError(errorHandler);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────

describe("sessions route", () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockReset();
    vi.mocked(logoutCurrentSession).mockReset();
    vi.mocked(revokeSession).mockReset();
    vi.mocked(revokeAllSessions).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── GET /auth/sessions ──────────────────────────────────────────

  describe("GET /auth/sessions", () => {
    it("applies authMiddleware to session endpoints", () => {
      // authMiddleware is called during route module initialization
      expect(vi.mocked(authMiddleware)).toHaveBeenCalled();
    });

    it("returns session list for authenticated user", async () => {
      const mockSessions = {
        sessions: [
          { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 9000 },
          { id: "sess_2", createdAt: 1500, lastActive: 2500, expiresAt: 9500 },
        ],
        nextCursor: "sess_2",
      };
      vi.mocked(listSessions).mockResolvedValueOnce(mockSessions);

      const app = createApp();
      const res = await app.request("/auth/sessions");

      expect(res.status).toBe(200);
      const body = (await res.json()) as typeof mockSessions;
      expect(body.sessions).toHaveLength(2);
      expect(body.nextCursor).toBe("sess_2");
      expect(vi.mocked(listSessions)).toHaveBeenCalledWith({}, "acct_test", undefined, 25);
    });

    it("uses default limit when limit param is NaN", async () => {
      vi.mocked(listSessions).mockResolvedValueOnce({
        sessions: [],
        nextCursor: null,
      });

      const app = createApp();
      const res = await app.request("/auth/sessions?limit=abc");

      expect(res.status).toBe(200);
      expect(vi.mocked(listSessions)).toHaveBeenCalledWith({}, "acct_test", undefined, 25);
    });

    it("passes cursor and limit query params", async () => {
      vi.mocked(listSessions).mockResolvedValueOnce({
        sessions: [],
        nextCursor: null,
      });

      const app = createApp();
      const res = await app.request("/auth/sessions?cursor=sess_abc&limit=10");

      expect(res.status).toBe(200);
      expect(vi.mocked(listSessions)).toHaveBeenCalledWith({}, "acct_test", "sess_abc", 10);
    });
  });

  // ── DELETE /auth/sessions/:id ───────────────────────────────────

  describe("DELETE /auth/sessions/:id", () => {
    it("returns 400 when trying to revoke the current session", async () => {
      const app = createApp();
      const res = await app.request("/auth/sessions/sess_current", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("POST /auth/logout");
    });

    it("returns 404 when session is not found", async () => {
      vi.mocked(revokeSession).mockResolvedValueOnce(false);

      const app = createApp();
      const res = await app.request("/auth/sessions/sess_other", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns ok: true on successful revocation", async () => {
      vi.mocked(revokeSession).mockResolvedValueOnce(true);

      const app = createApp();
      const res = await app.request("/auth/sessions/sess_other", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────

  describe("POST /auth/logout", () => {
    it("returns ok: true on successful logout", async () => {
      vi.mocked(logoutCurrentSession).mockResolvedValueOnce(undefined);

      const app = createApp();
      const res = await app.request("/auth/logout", { method: "POST" });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(vi.mocked(logoutCurrentSession)).toHaveBeenCalledWith(
        {},
        "sess_current",
        "acct_test",
        { ipAddress: null, userAgent: null },
      );
    });
  });

  // ── POST /auth/sessions/revoke-all ─────────────────────────────

  describe("POST /auth/sessions/revoke-all", () => {
    it("returns ok: true with revokedCount", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValueOnce(3);

      const app = createApp();
      const res = await app.request("/auth/sessions/revoke-all", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; revokedCount: number };
      expect(body.ok).toBe(true);
      expect(body.revokedCount).toBe(3);
      expect(vi.mocked(revokeAllSessions)).toHaveBeenCalledWith({}, "acct_test", "sess_current", {
        ipAddress: null,
        userAgent: null,
      });
    });
  });
});
