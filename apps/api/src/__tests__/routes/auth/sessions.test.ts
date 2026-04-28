import { PAGINATION, brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fromCursor, toCursor } from "../../../lib/pagination.js";
import {
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, SessionId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/auth/sessions.js", () => ({
  listSessions: vi.fn(),
  logoutCurrentSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/session-auth.js", () => ({
  validateSession: vi.fn(),
}));

const MOCK_CURRENT_SESSION_ID = "sess_00000000-0000-4000-8000-000000000001";
const MOCK_OTHER_SESSION_ID = "sess_00000000-0000-4000-8000-000000000002";

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(
      () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
          c.set("auth", {
            authMethod: "session",
            accountId: "acct_test",
            sessionId: MOCK_CURRENT_SESSION_ID,
            systemId: null,
            accountType: "system",
            ownedSystemIds: new Set(),
            auditLogIpTracking: false,
          });
          await next();
        },
    ),
}));
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { listSessions, logoutCurrentSession, revokeSession, revokeAllSessions } =
  await import("../../../services/auth/sessions.js");
const { authMiddleware } = await import("../../../middleware/auth.js");
const { sessionsRoute } = await import("../../../routes/auth/sessions.js");
const { authRoutes } = await import("../../../routes/auth/index.js");
const { MAX_SESSION_LIMIT } = await import("../../../routes/auth/auth.constants.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/auth", sessionsRoute);
const createAuthApp = () => createRouteApp("/auth", authRoutes);

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

  // ── Cache-Control ──────────────────────────────────────────────

  describe("Cache-Control", () => {
    it("sets Cache-Control: no-store on GET /auth/sessions", async () => {
      vi.mocked(listSessions).mockResolvedValueOnce({ sessions: [], nextCursor: null });

      const app = createAuthApp();
      const res = await app.request("/auth/sessions");

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  // ── GET /auth/sessions ──────────────────────────────────────────

  describe("GET /auth/sessions", () => {
    it("applies authMiddleware at the router level", () => {
      // authMiddleware is applied at router level via .use("*", ...)
      // Called multiple times across auth sub-routes (sessions, recovery-key)
      expect(vi.mocked(authMiddleware)).toHaveBeenCalled();
    });

    it("returns session list for authenticated user", async () => {
      const mockSessions = {
        sessions: [
          {
            id: brandId<SessionId>("sess_1"),
            createdAt: 1000,
            lastActive: 2000,
            expiresAt: 9000,
            encryptedData: null,
          },
          {
            id: brandId<SessionId>("sess_2"),
            createdAt: 1500,
            lastActive: 2500,
            expiresAt: 9500,
            encryptedData: null,
          },
        ],
        nextCursor: toCursor("sess_2"),
      };
      vi.mocked(listSessions).mockResolvedValueOnce(mockSessions);

      const app = createApp();
      const res = await app.request("/auth/sessions");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: typeof mockSessions };
      expect(body.data.sessions).toHaveLength(2);
      expect(body.data.nextCursor).not.toBeNull();
      if (body.data.nextCursor) {
        expect(fromCursor(body.data.nextCursor, PAGINATION.cursorTtlMs)).toBe("sess_2");
      }
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
      const res = await app.request(`/auth/sessions?cursor=${toCursor("sess_abc")}&limit=10`);

      expect(res.status).toBe(200);
      expect(vi.mocked(listSessions)).toHaveBeenCalledWith({}, "acct_test", "sess_abc", 10);
    });

    it("caps limit to MAX_SESSION_LIMIT when value exceeds max", async () => {
      vi.mocked(listSessions).mockResolvedValueOnce({
        sessions: [],
        nextCursor: null,
      });

      const app = createApp();
      const res = await app.request("/auth/sessions?limit=999");

      expect(res.status).toBe(200);
      expect(vi.mocked(listSessions)).toHaveBeenCalledWith(
        {},
        "acct_test",
        undefined,
        MAX_SESSION_LIMIT,
      );
    });
  });

  // ── DELETE /auth/sessions/:id ───────────────────────────────────

  describe("DELETE /auth/sessions/:id", () => {
    it("returns 400 for a malformed session ID", async () => {
      const app = createApp();
      const res = await app.request("/auth/sessions/not-a-valid-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when trying to revoke the current session", async () => {
      const app = createApp();
      const res = await app.request(`/auth/sessions/${MOCK_CURRENT_SESSION_ID}`, {
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
      const res = await app.request(`/auth/sessions/${MOCK_OTHER_SESSION_ID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 204 on successful revocation", async () => {
      vi.mocked(revokeSession).mockResolvedValueOnce(true);

      const app = createApp();
      const res = await app.request(`/auth/sessions/${MOCK_OTHER_SESSION_ID}`, {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
      expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ accountId: "acct_test" }),
      );
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────

  describe("POST /auth/logout", () => {
    it("returns 204 on successful logout", async () => {
      vi.mocked(logoutCurrentSession).mockResolvedValueOnce(undefined);

      const app = createApp();
      const res = await app.request("/auth/logout", { method: "POST" });

      expect(res.status).toBe(204);
      expect(vi.mocked(logoutCurrentSession)).toHaveBeenCalledWith(
        {},
        MOCK_CURRENT_SESSION_ID,
        "acct_test",
        expect.any(Function),
      );
      expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ accountId: "acct_test" }),
      );
    });
  });

  // ── POST /auth/sessions/revoke-all ─────────────────────────────

  describe("POST /auth/sessions/revoke-all", () => {
    it("returns revokedCount in data envelope", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValueOnce(3);

      const app = createApp();
      const res = await app.request("/auth/sessions/revoke-all", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { revokedCount: number };
      };
      expect(body.data.revokedCount).toBe(3);
      expect(vi.mocked(revokeAllSessions)).toHaveBeenCalledWith(
        {},
        "acct_test",
        MOCK_CURRENT_SESSION_ID,
        expect.any(Function),
      );
      expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ accountId: "acct_test" }),
      );
    });
  });
});
