import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { createGroup } from "../../../services/group.service.js";
import { groupRouter } from "../../../trpc/routers/group.js";
import { noopAudit, testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedMember,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { GroupId, MemberId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const INITIAL_GROUP_VERSION = 1;

/** Default sortOrder used when seeding groups via the local helper. */
const DEFAULT_SORT_ORDER = 0;

/** Reorder sortOrder applied to the first seeded group in the reorder happy-path. */
const REORDER_TARGET_SORT_ORDER = 5;

/**
 * Seed a root group via the real `createGroup` service path.
 *
 * Lives in this file (not `integration-helpers.ts`) because no other router
 * test currently needs to seed groups. Promote to the shared helpers module
 * if a second router takes a dependency on this.
 */
async function seedGroup(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<GroupId> {
  const result = await createGroup(
    db,
    systemId,
    {
      encryptedData: testEncryptedDataBase64(),
      parentGroupId: null,
      sortOrder: DEFAULT_SORT_ORDER,
    },
    auth,
    noopAudit,
  );
  return result.id;
}

describe("group router integration", () => {
  const fixture = setupRouterFixture({ group: groupRouter });

  describe("group.create", () => {
    it("creates a root group belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      // CreateGroupBodySchema requires `parentGroupId` (nullable, NOT optional)
      // and `sortOrder` (int >= 0). Pass `null` for root groups explicitly.
      const result = await caller.group.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        parentGroupId: null,
        sortOrder: DEFAULT_SORT_ORDER,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^grp_/);
    });
  });

  describe("group.get", () => {
    it("returns a group by id", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.get({
        systemId: primary.systemId,
        groupId,
      });
      expect(result.id).toBe(groupId);
    });
  });

  describe("group.list", () => {
    it("returns groups of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedGroup(db, primary.systemId, primary.auth);
      await seedGroup(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("group.update", () => {
    it("updates a group's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.update({
        systemId: primary.systemId,
        groupId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_GROUP_VERSION,
      });
      expect(result.id).toBe(groupId);
    });
  });

  describe("group.archive", () => {
    it("archives a group", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.archive({
        systemId: primary.systemId,
        groupId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("group.restore", () => {
    it("restores an archived group", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.group.archive({ systemId: primary.systemId, groupId });
      const restored = await caller.group.restore({
        systemId: primary.systemId,
        groupId,
      });
      expect(restored.id).toBe(groupId);
    });
  });

  describe("group.delete", () => {
    it("deletes a group", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.delete({
        systemId: primary.systemId,
        groupId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("group.move", () => {
    it("re-parents a group under another group", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const parentId = await seedGroup(db, primary.systemId, primary.auth);
      const childId = await seedGroup(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // MoveGroupBodySchema requires `targetParentGroupId` (nullable) and
      // `version`. The freshly seeded child sits at version 1.
      const result = await caller.group.move({
        systemId: primary.systemId,
        groupId: childId,
        targetParentGroupId: parentId,
        version: INITIAL_GROUP_VERSION,
      });
      expect(result.id).toBe(childId);
      expect(result.parentGroupId).toBe(parentId);
    });
  });

  describe("group.copy", () => {
    it("creates a copy of an existing group", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // CopyGroupBodySchema's `targetParentGroupId` is optional — undefined
      // means "same parent as source". `copyMemberships` defaults to false but
      // tRPC input inference still expects the key to be present.
      const result = await caller.group.copy({
        systemId: primary.systemId,
        groupId,
        targetParentGroupId: undefined,
        copyMemberships: false,
      });
      expect(result.id).not.toBe(groupId);
      expect(result.systemId).toBe(primary.systemId);
    });
  });

  describe("group.getTree", () => {
    it("returns the group hierarchy as a tree", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedGroup(db, primary.systemId, primary.auth);
      await seedGroup(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // getGroupTree returns GroupResultTree[] (roots with nested `children`).
      const result = await caller.group.getTree({ systemId: primary.systemId });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });
  });

  describe("group.reorder", () => {
    it("applies a batch of sortOrder updates", async () => {
      const primary = fixture.getPrimary();
      const groupId = await seedGroup(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.reorder({
        systemId: primary.systemId,
        operations: [{ groupId, sortOrder: REORDER_TARGET_SORT_ORDER }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("group.addMember", () => {
    it("adds a member to a group", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const groupId = await seedGroup(db, primary.systemId, primary.auth);
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.group.addMember({
        systemId: primary.systemId,
        groupId,
        memberId,
      });
      expect(result.groupId).toBe(groupId);
      expect(result.memberId).toBe(memberId);
    });
  });

  describe("group.removeMember", () => {
    it("removes a previously added member from a group", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const groupId = await seedGroup(db, primary.systemId, primary.auth);
      const memberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.group.addMember({
        systemId: primary.systemId,
        groupId,
        memberId,
      });
      const result = await caller.group.removeMember({
        systemId: primary.systemId,
        groupId,
        memberId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("group.listMembers", () => {
    it("returns the membership rows attached to a group", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      const groupId = await seedGroup(db, primary.systemId, primary.auth);
      const memberId: MemberId = await seedMember(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      await caller.group.addMember({
        systemId: primary.systemId,
        groupId,
        memberId,
      });
      const result = await caller.group.listMembers({
        systemId: primary.systemId,
        groupId,
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.memberId).toBe(memberId);
    });
  });

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.group.list({ systemId: primary.systemId }));
    });
  });

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's group", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherGroupId = await seedGroup(fixture.getCtx().db, other.systemId, other.auth);
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.group.get({
          systemId: other.systemId,
          groupId: otherGroupId,
        }),
      );
    });
  });
});
