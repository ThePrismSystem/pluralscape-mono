import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Set encryption key before module load so env.ts picks it up.
vi.hoisted(() => {
  process.env.WEBHOOK_PAYLOAD_ENCRYPTION_KEY = "ab".repeat(32);
});

import { createBoardMessage } from "../../../services/board-message/create.js";
import {
  archiveBoardMessage,
  restoreBoardMessage,
} from "../../../services/board-message/lifecycle.js";
import { pinBoardMessage, unpinBoardMessage } from "../../../services/board-message/pin.js";
import { getBoardMessage } from "../../../services/board-message/queries.js";
import { reorderBoardMessages } from "../../../services/board-message/reorder.js";
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
import type { AccountId, ServerSecret, SystemId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { boardMessages, webhookConfigs, webhookDeliveries } = schema;

describe("board-message.service (PGlite integration) — pin, reorder, lifecycle", () => {
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

  // ── PIN / UNPIN ─────────────────────────────────────────────────

  describe("pinBoardMessage", () => {
    it("pins an unpinned board message", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );
      const bm2 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
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

    it("throws VALIDATION_ERROR for duplicate board message IDs", async () => {
      const bm = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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

    it("throws NOT_FOUND when reorder includes an archived message", async () => {
      const bm1 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );
      const bm2 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
        auth,
        noopAudit,
      );
      await archiveBoardMessage(asDb(db), systemId, bm2.id, auth, noopAudit);

      await assertApiError(
        reorderBoardMessages(
          asDb(db),
          systemId,
          {
            operations: [
              { boardMessageId: bm1.id, sortOrder: 1 },
              { boardMessageId: bm2.id, sortOrder: 0 },
            ],
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("creates webhook delivery records for each reordered message", async () => {
      // Insert a webhook config subscribed to board-message.reordered
      const webhookId = brandId<WebhookId>(`wh_${crypto.randomUUID()}`);
      const ts = toUnixMillis(Date.now());
      await db.insert(webhookConfigs).values({
        id: webhookId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array(Buffer.from("test-secret")) as ServerSecret,
        eventTypes: ["board-message.reordered"],
        enabled: true,
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      });

      const bm1 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );
      const bm2 = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 1, pinned: false },
        auth,
        noopAudit,
      );

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
        noopAudit,
      );

      // Verify webhook deliveries were created for the reorder event
      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.eventType, "board-message.reordered"));
      expect(deliveries).toHaveLength(2);
      expect(deliveries.every((d) => d.webhookId === webhookId)).toBe(true);
      expect(deliveries.every((d) => d.status === "pending")).toBe(true);
    });
  });

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archiveBoardMessage / restoreBoardMessage", () => {
    it("archives a board message so it is no longer returned by get", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
});
