import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. Same block as the
// canonical member router integration test — keep BEFORE any module-level
// import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { frontingCommentRouter } from "../../../trpc/routers/fronting-comment.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedFrontingSession,
  seedMember,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { FrontingSessionId, MemberId } from "@pluralscape/types";

/** Initial version returned by createFrontingComment; required input for `update`. */
const INITIAL_COMMENT_VERSION = 1;

/**
 * Per-tenant seed bundle: every comment requires both a fronting session
 * (parent) and a member (subject). Built once per test in beforeEach so the
 * inner test bodies stay focused on the procedure under exercise.
 */
interface CommentSeed {
  readonly memberId: MemberId;
  readonly sessionId: FrontingSessionId;
}

describe("fronting-comment router integration", () => {
  const fixture = setupRouterFixture({ frontingComment: frontingCommentRouter });

  // Lazy holder for the per-test parent chain. Populated in the secondary
  // beforeEach below (which runs after the fixture's own beforeEach has
  // already seeded the primary tenant).
  let primarySeed: CommentSeed;

  beforeEach(async () => {
    const primary = fixture.getPrimary();
    const db = fixture.getCtx().db;
    const memberId = await seedMember(db, primary.systemId, primary.auth);
    const sessionId = await seedFrontingSession(db, primary.systemId, primary.auth, memberId);
    primarySeed = { memberId, sessionId };
  });

  /**
   * Seed a fronting comment via the real router create path. Returns the new
   * comment id. Uses the per-test session + member as parent + subject so the
   * comment's tenant scoping mirrors the rest of the suite.
   */
  async function seedComment(): Promise<string> {
    const primary = fixture.getPrimary();
    const caller = fixture.getCaller(primary.auth);
    // Zod's `.and()` widens `optionalBrandedId` keys to `unknown` (not
    // optional), so all subject keys must be present even when undefined.
    const result = await caller.frontingComment.create({
      systemId: primary.systemId,
      sessionId: primarySeed.sessionId,
      encryptedData: testEncryptedDataBase64(),
      memberId: primarySeed.memberId,
      customFrontId: undefined,
      structureEntityId: undefined,
    });
    return result.id;
  }

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("frontingComment.create", () => {
    it("creates a comment attached to the caller's session", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingComment.create({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        encryptedData: testEncryptedDataBase64(),
        memberId: primarySeed.memberId,
        customFrontId: undefined,
        structureEntityId: undefined,
      });
      expect(result.id).toMatch(/^fcom_/);
      expect(result.frontingSessionId).toBe(primarySeed.sessionId);
    });
  });

  describe("frontingComment.get", () => {
    it("returns a comment by id", async () => {
      const primary = fixture.getPrimary();
      const commentId = await seedComment();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingComment.get({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
      });
      expect(result.id).toBe(commentId);
    });
  });

  describe("frontingComment.list", () => {
    it("returns comments for the given session", async () => {
      const primary = fixture.getPrimary();
      await seedComment();
      await seedComment();
      const caller = fixture.getCaller(primary.auth);
      // listFrontingComments returns PaginatedResult ⇒ `data`, not `items`.
      const result = await caller.frontingComment.list({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
      });
      expect(result.data.length).toBe(2);
    });
  });

  describe("frontingComment.update", () => {
    it("updates a comment's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const commentId = await seedComment();
      const caller = fixture.getCaller(primary.auth);
      // UpdateFrontingCommentBodySchema requires `version` (optimistic
      // concurrency token). Newly seeded comments start at version 1.
      const result = await caller.frontingComment.update({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_COMMENT_VERSION,
      });
      expect(result.id).toBe(commentId);
    });
  });

  describe("frontingComment.archive", () => {
    it("archives a comment", async () => {
      const primary = fixture.getPrimary();
      const commentId = await seedComment();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingComment.archive({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("frontingComment.restore", () => {
    it("restores an archived comment", async () => {
      const primary = fixture.getPrimary();
      const commentId = await seedComment();
      const caller = fixture.getCaller(primary.auth);
      await caller.frontingComment.archive({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
      });
      const restored = await caller.frontingComment.restore({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
      });
      expect(restored.id).toBe(commentId);
    });
  });

  describe("frontingComment.delete", () => {
    it("deletes a comment", async () => {
      const primary = fixture.getPrimary();
      const commentId = await seedComment();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.frontingComment.delete({
        systemId: primary.systemId,
        sessionId: primarySeed.sessionId,
        commentId,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(
        caller.frontingComment.list({
          systemId: primary.systemId,
          sessionId: primarySeed.sessionId,
        }),
      );
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read another tenant's comment", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const db = fixture.getCtx().db;
      // Build the full parent chain inside the other tenant so the comment
      // exists but is invisible to `primary`.
      const otherMemberId = await seedMember(db, other.systemId, other.auth);
      const otherSessionId = await seedFrontingSession(
        db,
        other.systemId,
        other.auth,
        otherMemberId,
      );
      const otherCaller = fixture.getCaller(other.auth);
      const otherComment = await otherCaller.frontingComment.create({
        systemId: other.systemId,
        sessionId: otherSessionId,
        encryptedData: testEncryptedDataBase64(),
        memberId: otherMemberId,
        customFrontId: undefined,
        structureEntityId: undefined,
      });

      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.frontingComment.get({
          systemId: other.systemId,
          sessionId: otherSessionId,
          commentId: otherComment.id,
        }),
      );
    });
  });
});
