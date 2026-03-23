import { PGlite } from "@electric-sql/pglite";
import {
  accounts,
  customFronts,
  frontingComments,
  frontingSessions,
  members,
  systems,
  systemStructureEntities,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "@pluralscape/db/pg";
import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveFrontingSession,
  createFrontingSession,
  deleteFrontingSession,
  endFrontingSession,
  getActiveFronting,
  getFrontingSession,
  listFrontingSessions,
  restoreFrontingSession,
  updateFrontingSession,
} from "../../services/fronting-session.service.js";
import {
  genCustomFrontId,
  genMemberId,
  makeAuth,
  noopAudit,
  testBlob,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { CustomFrontId, FrontingSessionId, MemberId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  customFronts,
  frontingSessions,
  frontingComments,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityMemberLinks,
};

describe("fronting-session.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: string;
  let systemId: string;
  let memberId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);

    accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);

    memberId = genMemberId();
    const now = Date.now();
    await db.insert(members).values({
      id: memberId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingComments);
    await db.delete(frontingSessions);
    await db.delete(customFronts);
  });

  async function insertCustomFront(sysId = systemId): Promise<string> {
    const id = genCustomFrontId();
    const now = Date.now();
    await db.insert(customFronts).values({
      id,
      systemId: sysId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertMember(sysId = systemId): Promise<string> {
    const id = genMemberId();
    const now = Date.now();
    await db.insert(members).values({
      id,
      systemId: sysId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  function createParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      encryptedData: testEncryptedDataBase64(),
      startTime: Date.now(),
      memberId,
      ...overrides,
    };
  }

  // ── createFrontingSession ─────────────────────────────────────────

  describe("createFrontingSession", () => {
    it("creates a session with a member subject", async () => {
      const result = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^fs_/);
      expect(result.systemId).toBe(systemId);
      expect(result.memberId).toBe(memberId);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
    });

    it("creates a session with a custom front subject", async () => {
      const cfId = await insertCustomFront();
      const result = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ memberId: undefined, customFrontId: cfId }),
        auth,
        noopAudit,
      );

      expect(result.customFrontId).toBe(cfId);
      expect(result.memberId).toBeNull();
    });

    it("rejects invalid subject ID (member not in system)", async () => {
      const unknownMemberId = genMemberId();
      await expect(
        createFrontingSession(
          db as never,
          systemId as SystemId,
          createParams({ memberId: unknownMemberId }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found in this system");
    });

    it("rejects archived member as subject", async () => {
      const archivedMemberId = genMemberId();
      const now = Date.now();
      await db.insert(members).values({
        id: archivedMemberId,
        systemId,
        encryptedData: testBlob(),
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        createFrontingSession(
          db as never,
          systemId as SystemId,
          createParams({ memberId: archivedMemberId }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found in this system");
    });

    it("rejects payload without any subject", async () => {
      await expect(
        createFrontingSession(
          db as never,
          systemId as SystemId,
          { encryptedData: testEncryptedDataBase64(), startTime: Date.now() },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });

    it("stores encrypted blob and returns base64 data", async () => {
      const result = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.encryptedData.length).toBeGreaterThan(0);
    });
  });

  // ── listFrontingSessions ──────────────────────────────────────────

  describe("listFrontingSessions", () => {
    it("returns sessions ordered by id desc", async () => {
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: Date.now() - 2000 }),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: Date.now() - 1000 }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth);

      expect(result.items.length).toBe(2);
      // Verify descending order by string comparison
      const first = result.items[0]?.id ?? "";
      const second = result.items[1]?.id ?? "";
      expect(first > second).toBe(true);
    });

    it("filters by memberId", async () => {
      const otherMemberId = await insertMember();
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ memberId: otherMemberId }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        memberId: otherMemberId as MemberId,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.memberId).toBe(otherMemberId);
    });

    it("filters by customFrontId", async () => {
      const cfId = await insertCustomFront();
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ memberId: undefined, customFrontId: cfId }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        customFrontId: cfId as CustomFrontId,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.customFrontId).toBe(cfId);
    });

    it("filters activeOnly (no endTime)", async () => {
      const s1 = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: Date.now() - 5000 }),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      await endFrontingSession(
        db as never,
        systemId as SystemId,
        s1.id,
        { endTime: Date.now(), version: 1 },
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        activeOnly: true,
      });

      expect(result.items.length).toBe(1);
    });

    it("excludes archived by default", async () => {
      const s1 = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        s1.id,
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth);
      expect(result.items.length).toBe(1);
    });

    it("includes archived when includeArchived=true", async () => {
      const s1 = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        s1.id,
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        includeArchived: true,
      });
      expect(result.items.length).toBe(2);
    });

    it("supports cursor pagination", async () => {
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const page1 = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        limit: 1,
      });

      expect(page1.items.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const firstId = page1.items[0]?.id;
      expect(firstId).toBeDefined();

      // Use the first page's item ID as cursor
      const page2 = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        cursor: firstId,
        limit: 1,
      });

      expect(page2.items.length).toBe(1);
      expect(page2.items[0]?.id).not.toBe(firstId);
      expect(page2.hasMore).toBe(false);
    });

    it("filters by startFrom and startUntil", async () => {
      const baseTime = Date.now();
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: baseTime - 10000 }),
        auth,
        noopAudit,
      );
      const s2 = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: baseTime }),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: baseTime + 10000 }),
        auth,
        noopAudit,
      );

      const result = await listFrontingSessions(db as never, systemId as SystemId, auth, {
        startFrom: baseTime - 1,
        startUntil: baseTime + 1,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.id).toBe(s2.id);
    });
  });

  // ── getFrontingSession ────────────────────────────────────────────

  describe("getFrontingSession", () => {
    it("returns a session by id with correct field mapping", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      const result = await getFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
      );

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.memberId).toBe(memberId);
      expect(result.encryptedData).toBeTruthy();
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await expect(
        getFrontingSession(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for archived session", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });
  });

  // ── updateFrontingSession ─────────────────────────────────────────

  describe("updateFrontingSession", () => {
    it("updates on correct version", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await updateFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      expect(result.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      await updateFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await expect(
        updateFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Version conflict");
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await expect(
        updateFrontingSession(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });

  // ── endFrontingSession ────────────────────────────────────────────

  describe("endFrontingSession", () => {
    it("ends an active session", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      const endTime = Date.now();
      const result = await endFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        { endTime, version: 1 },
        auth,
        noopAudit,
      );

      expect(result.endTime).toBe(endTime);
      expect(result.version).toBe(2);
    });

    it("throws ALREADY_ENDED for already-ended session", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await endFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        { endTime: Date.now(), version: 1 },
        auth,
        noopAudit,
      );

      await expect(
        endFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          { endTime: Date.now(), version: 2 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("already ended");
    });

    it("rejects endTime <= startTime", async () => {
      const startTime = Date.now();
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await expect(
        endFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          { endTime: startTime - 1, version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("endTime must be after startTime");
    });

    it("throws CONFLICT on stale version (OCC check)", async () => {
      const startTime = Date.now() - 5000;
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime }),
        auth,
        noopAudit,
      );

      await updateFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await expect(
        endFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          { endTime: Date.now(), version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Version conflict");
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await expect(
        endFrontingSession(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          { endTime: Date.now(), version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });

  // ── deleteFrontingSession ─────────────────────────────────────────

  describe("deleteFrontingSession", () => {
    it("deletes a session with no comments", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      await deleteFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws HAS_DEPENDENTS with non-archived comments", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const now = Date.now();
      await db.insert(frontingComments).values({
        id: `fcom_${crypto.randomUUID()}`,
        frontingSessionId: created.id,
        systemId,
        sessionStartTime: created.startTime as number,
        memberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        deleteFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("non-archived comment");
    });

    it("passes HAS_DEPENDENTS check when all comments are archived", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const commentId = `fcom_${crypto.randomUUID()}`;
      const now = Date.now();
      await db.insert(frontingComments).values({
        id: commentId,
        frontingSessionId: created.id,
        systemId,
        sessionStartTime: created.startTime as number,
        memberId,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      // The HAS_DEPENDENTS check passes (only non-archived comments block),
      // but the FK RESTRICT still prevents deletion. Remove the comment first.
      await db.delete(frontingComments);

      await deleteFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );
    });

    it("throws NOT_FOUND for nonexistent session", async () => {
      await expect(
        deleteFrontingSession(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });

  // ── archiveFrontingSession / restoreFrontingSession ────────────────

  describe("archiveFrontingSession", () => {
    it("archives and hides session from non-archived queries", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws ALREADY_ARCHIVED for already-archived session", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      await expect(
        archiveFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("already archived");
    });
  });

  describe("restoreFrontingSession", () => {
    it("restores an archived session and increments version", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      const restored = await restoreFrontingSession(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.version).toBe(3);
    });

    it("throws for non-archived session", async () => {
      const created = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      await expect(
        restoreFrontingSession(
          db as never,
          systemId as SystemId,
          created.id,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not archived");
    });
  });

  // ── getActiveFronting ─────────────────────────────────────────────

  describe("getActiveFronting", () => {
    it("returns only active non-archived sessions", async () => {
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: Date.now() - 5000 }),
        auth,
        noopAudit,
      );

      const ended = await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ startTime: Date.now() - 10000 }),
        auth,
        noopAudit,
      );
      await endFrontingSession(
        db as never,
        systemId as SystemId,
        ended.id,
        { endTime: Date.now(), version: 1 },
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(db as never, systemId as SystemId, auth);
      expect(result.sessions.length).toBe(1);
    });

    it("isCofronting=false with single member session", async () => {
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(db as never, systemId as SystemId, auth);
      expect(result.isCofronting).toBe(false);
    });

    it("isCofronting=true with multiple member sessions", async () => {
      const otherMemberId = await insertMember();
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ memberId: otherMemberId }),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(db as never, systemId as SystemId, auth);
      expect(result.isCofronting).toBe(true);
    });

    it("isCofronting excludes custom-front-only sessions", async () => {
      const cfId = await insertCustomFront();
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams({ memberId: undefined, customFrontId: cfId }),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(db as never, systemId as SystemId, auth);
      expect(result.sessions.length).toBe(2);
      expect(result.isCofronting).toBe(false);
    });

    it("returns empty entityMemberMap when no structure entities", async () => {
      await createFrontingSession(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await getActiveFronting(db as never, systemId as SystemId, auth);
      expect(result.entityMemberMap).toEqual({});
    });
  });
});
