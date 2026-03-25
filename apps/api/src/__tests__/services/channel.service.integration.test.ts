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
  archiveChannel,
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  restoreChannel,
  updateChannel,
} from "../../services/channel.service.js";
import {
  assertApiError,
  asDb,
  genChannelId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { channels, messages } = schema;

describe("channel.service (PGlite integration)", () => {
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
    await db.delete(messages);
    await db.delete(channels);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createChannel", () => {
    it("creates a category and returns expected shape", async () => {
      const audit = spyAudit();
      const result = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        audit,
      );

      expect(result.id).toMatch(/^ch_/);
      expect(result.systemId).toBe(systemId);
      expect(result.type).toBe("category");
      expect(result.parentId).toBeNull();
      expect(result.sortOrder).toBe(0);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("channel.created");
    });

    it("creates a channel under a category", async () => {
      const category = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const channel = await createChannel(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          type: "channel",
          parentId: category.id,
          sortOrder: 0,
        },
        auth,
        noopAudit,
      );

      expect(channel.type).toBe("channel");
      expect(channel.parentId).toBe(category.id);
    });

    it("rejects category with parentId", async () => {
      const category = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        createChannel(
          asDb(db),
          systemId,
          {
            encryptedData: testEncryptedDataBase64(),
            type: "category",
            parentId: category.id,
            sortOrder: 0,
          },
          auth,
          noopAudit,
        ),
        "INVALID_HIERARCHY",
        409,
      );
    });

    it("rejects channel with non-category parent", async () => {
      const channel1 = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        createChannel(
          asDb(db),
          systemId,
          {
            encryptedData: testEncryptedDataBase64(),
            type: "channel",
            parentId: channel1.id,
            sortOrder: 0,
          },
          auth,
          noopAudit,
        ),
        "INVALID_HIERARCHY",
        409,
      );
    });

    it("rejects channel with non-existent parentId", async () => {
      await assertApiError(
        createChannel(
          asDb(db),
          systemId,
          {
            encryptedData: testEncryptedDataBase64(),
            type: "channel",
            parentId: genChannelId(),
            sortOrder: 0,
          },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getChannel", () => {
    it("retrieves a previously created channel", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const result = await getChannel(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.type).toBe("category");
    });

    it("throws NOT_FOUND for non-existent ID", async () => {
      await assertApiError(getChannel(asDb(db), systemId, genChannelId(), auth), "NOT_FOUND", 404);
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listChannels", () => {
    it("lists channels with pagination", async () => {
      for (let i = 0; i < 3; i++) {
        await createChannel(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: i },
          auth,
          noopAudit,
        );
      }

      const page1 = await listChannels(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
    });

    it("filters by type", async () => {
      await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );
      await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const categories = await listChannels(asDb(db), systemId, auth, { type: "category" });
      expect(categories.items).toHaveLength(1);
      expect(categories.items[0]?.type).toBe("category");
    });

    it("filters by parentId", async () => {
      const category = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );
      await createChannel(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          type: "channel",
          parentId: category.id,
          sortOrder: 0,
        },
        auth,
        noopAudit,
      );
      await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 1 },
        auth,
        noopAudit,
      );

      const filtered = await listChannels(asDb(db), systemId, auth, { parentId: category.id });
      expect(filtered.items).toHaveLength(1);
      expect(filtered.items[0]?.parentId).toBe(category.id);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateChannel", () => {
    it("updates on correct version and increments version", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await updateChannel(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("channel.updated");
    });

    it("updates sortOrder", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const result = await updateChannel(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1, sortOrder: 5 },
        auth,
        noopAudit,
      );

      expect(result.sortOrder).toBe(5);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await updateChannel(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateChannel(
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

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archiveChannel / restoreChannel", () => {
    it("archives a channel so it is no longer returned by get", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveChannel(asDb(db), systemId, created.id, auth, noopAudit);
      await assertApiError(getChannel(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("restores an archived channel", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await archiveChannel(asDb(db), systemId, created.id, auth, noopAudit);
      const restored = await restoreChannel(asDb(db), systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deleteChannel", () => {
    it("deletes an empty channel", async () => {
      const created = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteChannel(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getChannel(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("channel.deleted");
    });

    it("returns 409 HAS_DEPENDENTS when category has child channels", async () => {
      const category = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );
      await createChannel(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          type: "channel",
          parentId: category.id,
          sortOrder: 0,
        },
        auth,
        noopAudit,
      );

      const err = await assertApiError(
        deleteChannel(asDb(db), systemId, category.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      expect((err.details as { dependents: unknown[] }).dependents).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "channels" })]),
      );
    });

    it("returns 409 HAS_DEPENDENTS when channel has messages", async () => {
      const { createMessage } = await import("../../services/message.service.js");

      const channel = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await createMessage(
        asDb(db),
        systemId,
        channel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const err = await assertApiError(
        deleteChannel(asDb(db), systemId, channel.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
      expect((err.details as { dependents: unknown[] }).dependents).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "messages" })]),
      );
    });

    it("throws NOT_FOUND for non-existent channel", async () => {
      await assertApiError(
        deleteChannel(asDb(db), systemId, genChannelId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });
});
