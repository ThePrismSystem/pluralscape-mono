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

import { memberRouter } from "../../../trpc/routers/member.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedMember,
  setupRouterFixture,
} from "../integration-helpers.js";

/** Initial version returned by createMember; required input for `update`. */
const INITIAL_MEMBER_VERSION = 1;

describe("member router integration", () => {
  const fixture = setupRouterFixture({ member: memberRouter });

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("member.create", () => {
    it("creates a member belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.member.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^mem_/);
    });
  });

  describe("member.get", () => {
    it("returns a member by id", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.member.get({
        systemId: primary.systemId,
        memberId,
      });
      expect(result.id).toBe(memberId);
    });
  });

  describe("member.list", () => {
    it("returns members of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedMember(db, primary.systemId, primary.auth);
      await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // listMembers returns PaginatedResult<MemberResult> ⇒ `data`, not `items`.
      const result = await caller.member.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("member.update", () => {
    it("updates a member's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // UpdateMemberBodySchema requires `version` (optimistic concurrency token).
      // Newly seeded members start at version 1.
      const result = await caller.member.update({
        systemId: primary.systemId,
        memberId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_MEMBER_VERSION,
      });
      expect(result.id).toBe(memberId);
    });
  });

  describe("member.duplicate", () => {
    it("creates a copy of an existing member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.member.duplicate({
        systemId: primary.systemId,
        memberId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.id).not.toBe(memberId);
      expect(result.systemId).toBe(primary.systemId);
    });
  });

  describe("member.archive", () => {
    it("archives a member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.member.archive({
        systemId: primary.systemId,
        memberId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("member.restore", () => {
    it("restores an archived member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.member.archive({
        systemId: primary.systemId,
        memberId,
      });
      const restored = await caller.member.restore({
        systemId: primary.systemId,
        memberId,
      });
      expect(restored.id).toBe(memberId);
    });
  });

  describe("member.delete", () => {
    it("deletes a member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.member.delete({
        systemId: primary.systemId,
        memberId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("member.listMemberships", () => {
    it("returns membership listings for a member", async () => {
      const primary = fixture.getPrimary();
      const memberId = await seedMember(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // Returns MemberMembershipsResult: { groups, structureEntities } — an
      // object grouping memberships by structure type, not a flat array.
      const result = await caller.member.listMemberships({
        systemId: primary.systemId,
        memberId,
      });
      expect(Array.isArray(result.groups)).toBe(true);
      expect(Array.isArray(result.structureEntities)).toBe(true);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.member.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's member", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherMemberId = await seedMember(fixture.getCtx().db, other.systemId, other.auth);
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.member.get({
          systemId: other.systemId,
          memberId: otherMemberId,
        }),
      );
    });
  });
});
