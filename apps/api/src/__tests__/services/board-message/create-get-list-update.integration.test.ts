import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Set encryption key before module load so env.ts picks it up.
vi.hoisted(() => {
  process.env.WEBHOOK_PAYLOAD_ENCRYPTION_KEY = "ab".repeat(32);
});

import { createBoardMessage } from "../../../services/board-message/create.js";
import {
  archiveBoardMessage,
} from "../../../services/board-message/lifecycle.js";
import { getBoardMessage, listBoardMessages } from "../../../services/board-message/queries.js";
import { updateBoardMessage } from "../../../services/board-message/update.js";
import { clearWebhookConfigCache } from "../../../services/webhook-dispatcher.js";
import {
  assertApiError,
  asDb,
  genBoardMessageId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../../helpers/integration-setup.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { boardMessages, webhookConfigs, webhookDeliveries } = schema;

describe("board-message.service (PGlite integration) — create, get, list, update", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    await initSodium();
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    clearWebhookConfigCache();
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
    await db.delete(boardMessages);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createBoardMessage", () => {
    it("creates a board message and returns expected shape", async () => {
      const audit = spyAudit();
      const result = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
          { encryptedData: testEncryptedDataBase64(), sortOrder: i, pinned: false },
          auth,
          noopAudit,
        );
      }

      const page1 = await listBoardMessages(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
    });

    it("returns items ordered by sortOrder ascending", async () => {
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 2, pinned: false },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
        auth,
        noopAudit,
      );

      const result = await listBoardMessages(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(3);
      expect(result.data[0]?.sortOrder).toBe(0);
      expect(result.data[1]?.sortOrder).toBe(1);
      expect(result.data[2]?.sortOrder).toBe(2);
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
        auth,
        noopAudit,
      );

      const pinned = await listBoardMessages(asDb(db), systemId, auth, { pinned: true });
      expect(pinned.data).toHaveLength(1);
      expect(pinned.data[0]?.pinned).toBe(true);
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
        auth,
        noopAudit,
      );

      const unpinned = await listBoardMessages(asDb(db), systemId, auth, { pinned: false });
      expect(unpinned.data).toHaveLength(1);
      expect(unpinned.data[0]?.pinned).toBe(false);
    });

    it("excludes archived by default", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, bm.id, auth, noopAudit);

      const result = await listBoardMessages(asDb(db), systemId, auth);
      expect(result.data.every((item) => item.id !== bm.id)).toBe(true);
    });

    it("includes archived when includeArchived is true", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );

      await archiveBoardMessage(asDb(db), systemId, bm.id, auth, noopAudit);

      const result = await listBoardMessages(asDb(db), systemId, auth, { includeArchived: true });
      expect(result.data.some((item) => item.id === bm.id)).toBe(true);
    });

    it("follows cursor to page 2 with no overlap", async () => {
      for (let i = 0; i < 3; i++) {
        await createBoardMessage(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64(), sortOrder: i, pinned: false },
          auth,
          noopAudit,
        );
      }

      const page1 = await listBoardMessages(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listBoardMessages(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.data.map((bm) => bm.id), ...page2.data.map((bm) => bm.id)];
      expect(new Set(allIds).size).toBe(3);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateBoardMessage", () => {
    it("updates on correct version and increments version", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
});
