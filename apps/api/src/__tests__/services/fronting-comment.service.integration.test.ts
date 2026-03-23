import { PGlite } from "@electric-sql/pglite";
import {
  accounts,
  customFronts,
  frontingComments,
  frontingSessions,
  members,
  systems,
  systemStructureEntities,
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
  archiveFrontingComment,
  createFrontingComment,
  deleteFrontingComment,
  getFrontingComment,
  listFrontingComments,
  restoreFrontingComment,
  updateFrontingComment,
} from "../../services/fronting-comment.service.js";
import {
  archiveFrontingSession,
  createFrontingSession,
} from "../../services/fronting-session.service.js";
import {
  genMemberId,
  makeAuth,
  noopAudit,
  testBlob,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { FrontingCommentId, FrontingSessionId, SystemId } from "@pluralscape/types";
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
};

describe("fronting-comment.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let memberId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);

    const accountId = await pgInsertAccount(db);
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

  async function createSession(): Promise<string> {
    const result = await createFrontingSession(
      db as never,
      systemId as SystemId,
      {
        encryptedData: testEncryptedDataBase64(),
        startTime: Date.now(),
        memberId,
      },
      auth,
      noopAudit,
    );
    return result.id;
  }

  function commentParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      encryptedData: testEncryptedDataBase64(),
      memberId,
      ...overrides,
    };
  }

  describe("createFrontingComment", () => {
    it("creates a comment on an existing session", async () => {
      const sid = await createSession();
      const result = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^fcom_/);
      expect(result.frontingSessionId).toBe(sid);
      expect(result.memberId).toBe(memberId);
    });

    it("throws NOT_FOUND if parent session does not exist", async () => {
      await expect(
        createFrontingComment(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          commentParams(),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws SESSION_ARCHIVED for archived parent", async () => {
      const sid = await createSession();

      await archiveFrontingSession(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        auth,
        noopAudit,
      );

      await expect(
        createFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          commentParams(),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("archived session");
    });

    it("validates subject IDs", async () => {
      const sid = await createSession();
      await expect(
        createFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          commentParams({ memberId: genMemberId() }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found in this system");
    });
  });

  describe("listFrontingComments", () => {
    it("throws NOT_FOUND if parent session does not exist", async () => {
      await expect(
        listFrontingComments(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("excludes archived by default", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      const result = await listFrontingComments(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        auth,
      );
      expect(result.items.length).toBe(1);
    });

    it("includes archived when includeArchived=true", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      const result = await listFrontingComments(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        auth,
        { includeArchived: true },
      );
      expect(result.items.length).toBe(2);
    });

    it("supports cursor pagination by ID desc", async () => {
      const sid = await createSession();
      await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );

      const page1 = await listFrontingComments(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        auth,
        { limit: 1 },
      );
      expect(page1.items.length).toBe(1);
      expect(page1.hasMore).toBe(true);
    });
  });

  describe("getFrontingComment", () => {
    it("throws NOT_FOUND if parent session does not exist", async () => {
      await expect(
        getFrontingComment(
          db as never,
          systemId as SystemId,
          `fs_${crypto.randomUUID()}` as FrontingSessionId,
          `fcom_${crypto.randomUUID()}` as FrontingCommentId,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for archived comment", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          c1.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });
  });

  describe("updateFrontingComment", () => {
    it("updates on correct version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );

      const result = await updateFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await updateFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );
      await expect(
        updateFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          c1.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Version conflict");
    });
  });

  describe("deleteFrontingComment", () => {
    it("always succeeds (leaf entity)", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );

      await deleteFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          c1.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for nonexistent comment", async () => {
      const sid = await createSession();
      await expect(
        deleteFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          `fcom_${crypto.randomUUID()}` as FrontingCommentId,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });

  describe("archiveFrontingComment / restoreFrontingComment", () => {
    it("archives a comment", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );

      await archiveFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      await expect(
        getFrontingComment(
          db as never,
          systemId as SystemId,
          sid as FrontingSessionId,
          c1.id,
          auth,
        ),
      ).rejects.toThrow("not found");
    });

    it("restores an archived comment and increments version", async () => {
      const sid = await createSession();
      const c1 = await createFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        commentParams(),
        auth,
        noopAudit,
      );
      await archiveFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );

      const restored = await restoreFrontingComment(
        db as never,
        systemId as SystemId,
        sid as FrontingSessionId,
        c1.id,
        auth,
        noopAudit,
      );
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });
});
