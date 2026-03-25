import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveBoardMessage,
  createBoardMessage,
  deleteBoardMessage,
  getBoardMessage,
  listBoardMessages,
  pinBoardMessage,
  reorderBoardMessages,
  restoreBoardMessage,
  unpinBoardMessage,
  updateBoardMessage,
} from "../../services/board-message.service.js";
import {
  assertApiError,
  asDb,
  genBoardMessageId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { boardMessages } = schema;

describe("board-message.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(boardMessages);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createBoardMessage", () => {
    it("creates a board message and returns expected shape", async () => {
      const audit = spyAudit();
      const result = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        audit,
      );

      expect(result.id).toMatch(/^bm_/);
      expect(result.systemId).toBe(systemId);
      expect(result.sortOrder).toBe(0);
      expect(result.pinned).toBe(false);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.createdAt).toEqual(expect.any(Number));
      expect(result.updatedAt).toEqual(expect.any(Number));
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("board-message.created");
    });

    it("defaults pinned to false when omitted", async () => {
      const result = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );
      expect(result.pinned).toBe(false);
    });

    it("creates with pinned=true when specified", async () => {
      const result = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );
      expect(result.pinned).toBe(true);
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getBoardMessage", () => {
    it("retrieves a previously created board message", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const result = await getBoardMessage(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.sortOrder).toBe(0);
    });

    it("throws NOT_FOUND for non-existent ID", async () => {
      await assertApiError(
        getBoardMessage(asDb(db), systemId, genBoardMessageId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listBoardMessages", () => {
    it("lists board messages with pagination", async () => {
      for (let i = 0; i < 3; i++) {
        await createBoardMessage(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64(), sortOrder: i },
          auth,
          noopAudit,
        );
      }

      const page1 = await listBoardMessages(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
    });

    it("returns items ordered by sortOrder ascending", async () => {
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 2 },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1 },
        auth,
        noopAudit,
      );

      const result = await listBoardMessages(asDb(db), systemId, auth);
      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.sortOrder).toBe(0);
      expect(result.items[1]?.sortOrder).toBe(1);
      expect(result.items[2]?.sortOrder).toBe(2);
    });

    it("filters by pinned", async () => {
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1 },
        auth,
        noopAudit,
      );

      const pinned = await listBoardMessages(asDb(db), systemId, auth, { pinned: true });
      expect(pinned.items).toHaveLength(1);
      expect(pinned.items[0]?.pinned).toBe(true);
    });

    it("filters by pinned=false", async () => {
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1 },
        auth,
        noopAudit,
      );

      const unpinned = await listBoardMessages(asDb(db), systemId, auth, { pinned: false });
      expect(unpinned.items).toHaveLength(1);
      expect(unpinned.items[0]?.pinned).toBe(false);
    });

    it("excludes archived by default", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, bm.id, auth, noopAudit);

      const result = await listBoardMessages(asDb(db), systemId, auth);
      expect(result.items.every((item) => item.id !== bm.id)).toBe(true);
    });

    it("includes archived when includeArchived is true", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, bm.id, auth, noopAudit);

      const result = await listBoardMessages(asDb(db), systemId, auth, { includeArchived: true });
      expect(result.items.some((item) => item.id === bm.id)).toBe(true);
    });

    it("follows cursor to page 2 with no overlap", async () => {
      for (let i = 0; i < 3; i++) {
        await createBoardMessage(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64(), sortOrder: i },
          auth,
          noopAudit,
        );
      }

      const page1 = await listBoardMessages(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listBoardMessages(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.items.map((bm) => bm.id), ...page2.items.map((bm) => bm.id)];
      expect(new Set(allIds).size).toBe(3);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateBoardMessage", () => {
    it("updates on correct version and increments version", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await updateBoardMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("board-message.updated");
    });

    it("updates sortOrder", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const result = await updateBoardMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1, sortOrder: 5 },
        auth,
        noopAudit,
      );

      expect(result.sortOrder).toBe(5);
    });

    it("updates pinned", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const result = await updateBoardMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1, pinned: true },
        auth,
        noopAudit,
      );

      expect(result.pinned).toBe(true);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await updateBoardMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateBoardMessage(
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

    it("throws NOT_FOUND for non-existent board message", async () => {
      await assertApiError(
        updateBoardMessage(
          asDb(db),
          systemId,
          genBoardMessageId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws CONFLICT when message was concurrently archived", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        updateBoardMessage(
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

  // ── PIN / UNPIN ─────────────────────────────────────────────────

  describe("pinBoardMessage", () => {
    it("pins an unpinned board message", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await pinBoardMessage(asDb(db), systemId, created.id, auth, audit);

      expect(result.pinned).toBe(true);
      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("board-message.pinned");
      expect(audit.calls[0]?.detail).toBe("Board message pinned");
    });

    it("throws ALREADY_ARCHIVED when message is archived", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        pinBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("throws ALREADY_PINNED when already pinned", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );

      await assertApiError(
        pinBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_PINNED",
        409,
      );
    });

    it("throws NOT_FOUND for non-existent board message", async () => {
      await assertApiError(
        pinBoardMessage(asDb(db), systemId, genBoardMessageId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("unpinBoardMessage", () => {
    it("unpins a pinned board message", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await unpinBoardMessage(asDb(db), systemId, created.id, auth, audit);

      expect(result.pinned).toBe(false);
      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("board-message.unpinned");
      expect(audit.calls[0]?.detail).toBe("Board message unpinned");
    });

    it("throws ALREADY_ARCHIVED when message is archived", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: true },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        unpinBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("throws NOT_PINNED when not pinned", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        unpinBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_PINNED",
        409,
      );
    });

    it("throws NOT_FOUND for non-existent board message", async () => {
      await assertApiError(
        unpinBoardMessage(asDb(db), systemId, genBoardMessageId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── REORDER ─────────────────────────────────────────────────────

  describe("reorderBoardMessages", () => {
    it("reorders multiple board messages", async () => {
      const bm1 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );
      const bm2 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await reorderBoardMessages(
        asDb(db),
        systemId,
        {
          operations: [
            { boardMessageId: bm1.id, sortOrder: 1 },
            { boardMessageId: bm2.id, sortOrder: 0 },
          ],
        },
        auth,
        audit,
      );

      // Verify sortOrder was updated by re-fetching individual messages
      const updated1 = await getBoardMessage(asDb(db), systemId, bm1.id, auth);
      const updated2 = await getBoardMessage(asDb(db), systemId, bm2.id, auth);
      expect(updated1.sortOrder).toBe(1);
      expect(updated2.sortOrder).toBe(0);
      expect(audit.calls[0]?.eventType).toBe("board-message.reordered");
    });

    it("throws NOT_FOUND for non-existent board message in operations", async () => {
      await assertApiError(
        reorderBoardMessages(
          asDb(db),
          systemId,
          {
            operations: [{ boardMessageId: genBoardMessageId(), sortOrder: 0 }],
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      await assertApiError(
        reorderBoardMessages(asDb(db), systemId, { operations: [] }, auth, noopAudit),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("throws VALIDATION_ERROR for duplicate board message IDs", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        reorderBoardMessages(
          asDb(db),
          systemId,
          {
            operations: [
              { boardMessageId: bm.id, sortOrder: 0 },
              { boardMessageId: bm.id, sortOrder: 1 },
            ],
          },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archiveBoardMessage / restoreBoardMessage", () => {
    it("archives a board message so it is no longer returned by get", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await archiveBoardMessage(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getBoardMessage(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("board-message.archived");
    });

    it("throws ALREADY_ARCHIVED when already archived", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("restores an archived board message", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, created.id, auth, noopAudit);
      const audit = spyAudit();
      const restored = await restoreBoardMessage(asDb(db), systemId, created.id, auth, audit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("board-message.restored");
    });

    it("throws NOT_ARCHIVED when not archived", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        restoreBoardMessage(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deleteBoardMessage", () => {
    it("deletes a board message (leaf entity, no dependent checks)", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteBoardMessage(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getBoardMessage(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("board-message.deleted");
    });

    it("throws NOT_FOUND for non-existent board message", async () => {
      await assertApiError(
        deleteBoardMessage(asDb(db), systemId, genBoardMessageId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
