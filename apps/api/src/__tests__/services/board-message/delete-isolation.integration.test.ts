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
import { deleteBoardMessage } from "../../../services/board-message/delete.js";
import { getBoardMessage, listBoardMessages } from "../../../services/board-message/queries.js";
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

describe("board-message.service (PGlite integration) — delete and cross-system isolation", () => {
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

  describe("cross-system isolation", () => {
    it("cannot access another system's board message by ID", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        getBoardMessage(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return another system's board messages", async () => {
      await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      const result = await listBoardMessages(asDb(db), otherSystemId, otherAuth);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("deleteBoardMessage", () => {
    it("deletes a board message (leaf entity, no dependent checks)", async () => {
      const created = await createBoardMessage(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), sortOrder: 0, pinned: false },
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
