import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. If you find yourself adding
// new vi.mock() calls in 3+ files, consider whether they belong in shared
// setup. Keep these BEFORE any module-level import that could transitively
// pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { dispatchWebhookEvent } from "../../../services/webhook-dispatcher.js";
import { frontingSessionRouter } from "../../../trpc/routers/fronting-session.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedFrontingSession,
  seedMember,
  setupRouterFixture,
} from "../integration-helpers.js";

/** Initial version returned by createFrontingSession; required input for `update`/`end`. */
const INITIAL_SESSION_VERSION = 1;

/** Offset (ms) added to a session's startTime to produce a valid endTime in tests. */
const END_TIME_OFFSET_MS = 60_000;

describe("fronting-session router integration", () => {
  const fixture = setupRouterFixture(
    { frontingSession: frontingSessionRouter },
    {
      clearMocks: () => {
        vi.mocked(dispatchWebhookEvent).mockClear();
      },
    },
  );

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("frontingSession.create", () => {
    it("creates a fronting session attributed to a member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // tRPC input inference widens optional branded-id fields to required
      // `unknown` keys, so we must spell out `undefined` for each unused
      // polymorphic subject.
      const result = await caller.frontingSession.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        startTime: Date.now(),
        memberId,
        customFrontId: undefined,
        structureEntityId: undefined,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^fs_/);
      expect(result.memberId).toBe(memberId);
      expect(vi.mocked(dispatchWebhookEvent)).toHaveBeenCalledWith(
        expect.anything(),
        primary.systemId,
        "fronting.started",
        expect.objectContaining({ sessionId: result.id }),
      );
    });
  });

  describe("frontingSession.get", () => {
    it("returns a fronting session by id", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingSession.get({
        systemId: primary.systemId,
        sessionId,
      });
      expect(result.id).toBe(sessionId);
    });
  });

  describe("frontingSession.list", () => {
    it("returns sessions of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      // listFrontingSessions returns PaginatedResult<FrontingSessionResult>
      // ⇒ `data`, not `items`.
      const result = await caller.frontingSession.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("frontingSession.update", () => {
    it("updates a session's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      // UpdateFrontingSessionBodySchema requires `version` (optimistic
      // concurrency token). Newly seeded sessions start at version 1.
      const result = await caller.frontingSession.update({
        systemId: primary.systemId,
        sessionId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_SESSION_VERSION,
      });
      expect(result.id).toBe(sessionId);
    });
  });

  describe("frontingSession.end", () => {
    it("ends an active session", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const startTime = Date.now();
      const caller = fixture.getCaller(primary.auth);
      // Create via the router so we know the exact startTime — `end` rejects
      // any endTime that isn't strictly greater than the stored startTime.
      const created = await caller.frontingSession.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        startTime,
        memberId,
        customFrontId: undefined,
        structureEntityId: undefined,
      });
      const result = await caller.frontingSession.end({
        systemId: primary.systemId,
        sessionId: created.id,
        endTime: startTime + END_TIME_OFFSET_MS,
        version: INITIAL_SESSION_VERSION,
      });
      expect(result.id).toBe(created.id);
      expect(result.endTime).toBe(startTime + END_TIME_OFFSET_MS);
      expect(vi.mocked(dispatchWebhookEvent)).toHaveBeenCalledWith(
        expect.anything(),
        primary.systemId,
        "fronting.ended",
        expect.objectContaining({ sessionId: created.id }),
      );
    });
  });

  describe("frontingSession.archive", () => {
    it("archives a session", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingSession.archive({
        systemId: primary.systemId,
        sessionId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("frontingSession.restore", () => {
    it("restores an archived session", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      await caller.frontingSession.archive({
        systemId: primary.systemId,
        sessionId,
      });
      const restored = await caller.frontingSession.restore({
        systemId: primary.systemId,
        sessionId,
      });
      expect(restored.id).toBe(sessionId);
    });
  });

  describe("frontingSession.delete", () => {
    it("deletes a session", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingSession.delete({
        systemId: primary.systemId,
        sessionId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("frontingSession.getActive", () => {
    it("returns currently fronting sessions for the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      // Seeded sessions have no endTime ⇒ they count as "active".
      await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingSession.getActive({
        systemId: primary.systemId,
      });
      expect(result.sessions.length).toBe(1);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.frontingSession.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's session", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const db = fixture.getCtx().db;
      const otherMemberId = await seedMember(db, other.systemId, other.auth);
      const otherSessionId = await seedFrontingSession(
        db,
        other.systemId,
        other.auth,
        otherMemberId,
      );
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.frontingSession.get({
          systemId: other.systemId,
          sessionId: otherSessionId,
        }),
      );
    });
  });
});
