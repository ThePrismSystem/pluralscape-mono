import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  createPgGroupsTables,
  pgExec,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));

import {
  addMember,
  listGroupMembers,
  removeMember,
} from "../../services/group-membership.service.js";
import {
  archiveGroup,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupTree,
  listGroups,
  moveGroup,
  reorderGroups,
  restoreGroup,
  updateGroup,
} from "../../services/group.service.js";
import {
  assertApiError,
  genGroupId,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
  asDb,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, GroupId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { groups, groupMemberships } = schema;

describe("group.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgGroupsTables(client);
    // field_values table is needed for the deleteGroup dependent check.
    // It requires systemStructureEntityTypes, systemStructureEntities,
    // buckets, and fieldDefinitions tables as FK targets.
    await pgExec(client, PG_DDL.systemStructureEntityTypes);
    await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
    await pgExec(client, PG_DDL.systemStructureEntities);
    await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
    await pgExec(client, PG_DDL.buckets);
    await pgExec(client, PG_DDL.bucketsIndexes);
    await pgExec(client, PG_DDL.fieldDefinitions);
    await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
    await pgExec(client, PG_DDL.fieldDefinitionScopes);
    await pgExec(client, PG_DDL.fieldDefinitionScopesIndexes);
    await pgExec(client, PG_DDL.fieldValues);
    await pgExec(client, PG_DDL.fieldValuesIndexes);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(groupMemberships);
    await db.delete(groups);
  });

  /** Shorthand to create a group with minimal params. */
  function groupParams(
    overrides: Partial<{
      encryptedData: string;
      parentGroupId: GroupId | null;
      sortOrder: number;
    }> = {},
  ): {
    encryptedData: string;
    parentGroupId: GroupId | null;
    sortOrder: number;
  } {
    return {
      encryptedData: testEncryptedDataBase64(),
      parentGroupId: null,
      sortOrder: 0,
      ...overrides,
    };
  }

  // ── createGroup ────────────────────────────────────────────────────

  describe("createGroup", () => {
    it("creates a root group with parentGroupId null", async () => {
      const audit = spyAudit();
      const result = await createGroup(asDb(db), systemId, groupParams(), auth, audit);

      expect(result.id).toMatch(/^grp_/);
      expect(result.systemId).toBe(systemId);
      expect(result.parentGroupId).toBeNull();
      expect(result.sortOrder).toBe(0);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("group.created");
    });

    it("creates a child group with a valid parentGroupId", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      expect(child.parentGroupId).toBe(parent.id);
      expect(child.sortOrder).toBe(1);
    });

    it("throws NOT_FOUND for nonexistent parentGroupId", async () => {
      await assertApiError(
        createGroup(
          asDb(db),
          systemId,
          groupParams({ parentGroupId: genGroupId() }),
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── getGroup ───────────────────────────────────────────────────────

  describe("getGroup", () => {
    it("retrieves a group by id", async () => {
      const created = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      const fetched = await getGroup(asDb(db), systemId, created.id, auth);
      expect(fetched.id).toBe(created.id);
      expect(fetched.encryptedData).toBe(created.encryptedData);
    });

    it("throws NOT_FOUND for nonexistent group", async () => {
      await assertApiError(getGroup(asDb(db), systemId, genGroupId(), auth), "NOT_FOUND", 404);
    });
  });

  // ── listGroups ─────────────────────────────────────────────────────

  describe("listGroups", () => {
    it("lists active groups for a system", async () => {
      await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await createGroup(asDb(db), systemId, groupParams({ sortOrder: 1 }), auth, noopAudit);

      const result = await listGroups(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("excludes archived groups", async () => {
      const g1 = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await createGroup(asDb(db), systemId, groupParams({ sortOrder: 1 }), auth, noopAudit);
      await archiveGroup(asDb(db), systemId, g1.id, auth, noopAudit);

      const result = await listGroups(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(1);
    });

    it("supports cursor pagination", async () => {
      await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await createGroup(asDb(db), systemId, groupParams({ sortOrder: 1 }), auth, noopAudit);

      const page1 = await listGroups(asDb(db), systemId, auth, undefined, 1);
      expect(page1.data).toHaveLength(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listGroups(asDb(db), systemId, auth, page1.data[0]?.id, 1);
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0]?.id).not.toBe(page1.data[0]?.id);
    });
  });

  // ── updateGroup ────────────────────────────────────────────────────

  describe("updateGroup", () => {
    it("increments version on update", async () => {
      const created = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      const updated = await updateGroup(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );
      expect(updated.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      await updateGroup(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateGroup(
          asDb(db),
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  // ── moveGroup ──────────────────────────────────────────────────────

  describe("moveGroup", () => {
    it("moves a group to a new parent", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ sortOrder: 1 }),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const moved = await moveGroup(
        asDb(db),
        systemId,
        child.id,
        { targetParentGroupId: parent.id, version: 1 },
        auth,
        audit,
      );

      expect(moved.parentGroupId).toBe(parent.id);
      expect(moved.version).toBe(2);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("group.moved");
    });

    it("moves a group to root (null parent)", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      const moved = await moveGroup(
        asDb(db),
        systemId,
        child.id,
        { targetParentGroupId: null, version: 1 },
        auth,
        noopAudit,
      );

      expect(moved.parentGroupId).toBeNull();
    });

    it("rejects self-parenting", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      await assertApiError(
        moveGroup(
          asDb(db),
          systemId,
          g.id,
          { targetParentGroupId: g.id, version: 1 },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("rejects circular ancestry", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      await assertApiError(
        moveGroup(
          asDb(db),
          systemId,
          parent.id,
          { targetParentGroupId: child.id, version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  // ── getGroupTree ───────────────────────────────────────────────────

  describe("getGroupTree", () => {
    it("returns hierarchical tree of groups", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      const tree = await getGroupTree(asDb(db), systemId, auth);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(parent.id);
      expect(tree[0]?.children).toHaveLength(1);
      expect(tree[0]?.children[0]?.id).toBe(child.id);
    });

    it("excludes archived groups from tree", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );
      await archiveGroup(asDb(db), systemId, child.id, auth, noopAudit);

      const tree = await getGroupTree(asDb(db), systemId, auth);
      expect(tree).toHaveLength(1);
      expect(tree[0]?.children).toHaveLength(0);
    });

    it("returns empty array when no groups exist", async () => {
      const tree = await getGroupTree(asDb(db), systemId, auth);
      expect(tree).toHaveLength(0);
    });
  });

  // ── reorderGroups ──────────────────────────────────────────────────

  describe("reorderGroups", () => {
    it("reorders groups by sortOrder", async () => {
      const g1 = await createGroup(
        asDb(db),
        systemId,
        groupParams({ sortOrder: 0 }),
        auth,
        noopAudit,
      );
      const g2 = await createGroup(
        asDb(db),
        systemId,
        groupParams({ sortOrder: 1 }),
        auth,
        noopAudit,
      );
      const g3 = await createGroup(
        asDb(db),
        systemId,
        groupParams({ sortOrder: 2 }),
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await reorderGroups(
        asDb(db),
        systemId,
        {
          operations: [
            { groupId: g1.id, sortOrder: 2 },
            { groupId: g2.id, sortOrder: 0 },
            { groupId: g3.id, sortOrder: 1 },
          ],
        },
        auth,
        audit,
      );

      const fetched1 = await getGroup(asDb(db), systemId, g1.id, auth);
      const fetched2 = await getGroup(asDb(db), systemId, g2.id, auth);
      const fetched3 = await getGroup(asDb(db), systemId, g3.id, auth);

      expect(fetched1.sortOrder).toBe(2);
      expect(fetched2.sortOrder).toBe(0);
      expect(fetched3.sortOrder).toBe(1);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("group.updated");
    });

    it("throws NOT_FOUND for nonexistent group in operations", async () => {
      await assertApiError(
        reorderGroups(
          asDb(db),
          systemId,
          { operations: [{ groupId: genGroupId(), sortOrder: 0 }] },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── archiveGroup / restoreGroup ────────────────────────────────────

  describe("archiveGroup / restoreGroup", () => {
    it("archives a group and hides it from get", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await archiveGroup(asDb(db), systemId, g.id, auth, noopAudit);

      await assertApiError(getGroup(asDb(db), systemId, g.id, auth), "NOT_FOUND", 404);
    });

    it("restores an archived group and increments version", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await archiveGroup(asDb(db), systemId, g.id, auth, noopAudit);

      const restored = await restoreGroup(asDb(db), systemId, g.id, auth, noopAudit);
      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      // archive bumps to 2, restore bumps to 3
      expect(restored.version).toBe(3);
    });
  });

  // ── deleteGroup ────────────────────────────────────────────────────

  describe("deleteGroup", () => {
    it("deletes a leaf group", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await deleteGroup(asDb(db), systemId, g.id, auth, noopAudit);

      await assertApiError(getGroup(asDb(db), systemId, g.id, auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND for nonexistent group", async () => {
      await assertApiError(
        deleteGroup(asDb(db), systemId, genGroupId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws HAS_DEPENDENTS when group has active child groups", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      await assertApiError(
        deleteGroup(asDb(db), systemId, parent.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("throws HAS_DEPENDENTS when group has memberships", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const memberId = brandId<MemberId>(await pgInsertMember(db, systemId, genMemberId()));

      await addMember(asDb(db), systemId, g.id, { memberId }, auth, noopAudit);

      await assertApiError(
        deleteGroup(asDb(db), systemId, g.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("allows delete after child groups are deleted", async () => {
      const parent = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const child = await createGroup(
        asDb(db),
        systemId,
        groupParams({ parentGroupId: parent.id, sortOrder: 1 }),
        auth,
        noopAudit,
      );

      // Delete child first, then parent succeeds
      await deleteGroup(asDb(db), systemId, child.id, auth, noopAudit);
      await deleteGroup(asDb(db), systemId, parent.id, auth, noopAudit);

      await assertApiError(getGroup(asDb(db), systemId, parent.id, auth), "NOT_FOUND", 404);
    });
  });

  // ── Group membership ───────────────────────────────────────────────

  describe("group membership", () => {
    let memberId: MemberId;

    beforeAll(async () => {
      memberId = brandId<MemberId>(await pgInsertMember(db, systemId, genMemberId()));
    });

    it("adds a member to a group", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      const audit = spyAudit();

      const result = await addMember(asDb(db), systemId, g.id, { memberId }, auth, audit);

      expect(result.groupId).toBe(g.id);
      expect(result.memberId).toBe(memberId);
      expect(result.systemId).toBe(systemId);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("group-membership.added");
    });

    it("rejects duplicate membership", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await addMember(asDb(db), systemId, g.id, { memberId }, auth, noopAudit);

      await assertApiError(
        addMember(asDb(db), systemId, g.id, { memberId }, auth, noopAudit),
        "CONFLICT",
        409,
      );
    });

    it("lists group members", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await addMember(asDb(db), systemId, g.id, { memberId }, auth, noopAudit);

      const result = await listGroupMembers(asDb(db), systemId, g.id, auth);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.memberId).toBe(memberId);
    });

    it("removes a member from a group", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);
      await addMember(asDb(db), systemId, g.id, { memberId }, auth, noopAudit);

      await removeMember(asDb(db), systemId, g.id, memberId, auth, noopAudit);

      const result = await listGroupMembers(asDb(db), systemId, g.id, auth);
      expect(result.data).toHaveLength(0);
    });

    it("throws NOT_FOUND when removing nonexistent membership", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      await assertApiError(
        removeMember(asDb(db), systemId, g.id, memberId, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when adding to nonexistent group", async () => {
      await assertApiError(
        addMember(asDb(db), systemId, genGroupId(), { memberId }, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when adding nonexistent member", async () => {
      const g = await createGroup(asDb(db), systemId, groupParams(), auth, noopAudit);

      await assertApiError(
        addMember(asDb(db), systemId, g.id, { memberId: genMemberId() }, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
