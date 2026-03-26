import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { archiveChannel, createChannel } from "../../services/channel.service.js";
import {
  archiveMessage,
  createMessage,
  deleteMessage,
  getMessage,
  listMessages,
  restoreMessage,
  updateMessage,
} from "../../services/message.service.js";
import {
  assertApiError,
  asDb,
  genChannelId,
  genMessageId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelResult } from "../../services/channel.service.js";
import type { AccountId, SystemId, UnixMillis } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { channels, messages } = schema;

describe("message.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;
  let testChannel: ChannelResult;

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

  beforeEach(async () => {
    testChannel = await createChannel(
      asDb(db),
      systemId,
      { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
      auth,
      noopAudit,
    );
  });

  afterEach(async () => {
    await db.delete(messages);
    await db.delete(channels);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createMessage", () => {
    it("creates a message and returns expected shape", async () => {
      const audit = spyAudit();
      const ts = Date.now();
      const result = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: ts },
        auth,
        audit,
      );

      expect(result.id).toMatch(/^msg_/);
      expect(result.channelId).toBe(testChannel.id);
      expect(result.systemId).toBe(systemId);
      expect(result.timestamp).toBe(ts);
      expect(result.replyToId).toBeNull();
      expect(result.editedAt).toBeNull();
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("message.created");
    });

    it("creates a message with replyToId", async () => {
      const ts = Date.now();
      const msg1 = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: ts },
        auth,
        noopAudit,
      );

      const msg2 = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        {
          encryptedData: testEncryptedDataBase64(),
          timestamp: ts + 1,
          replyToId: msg1.id,
        },
        auth,
        noopAudit,
      );

      expect(msg2.replyToId).toBe(msg1.id);
    });

    it("throws NOT_FOUND when channel does not exist", async () => {
      await assertApiError(
        createMessage(
          asDb(db),
          systemId,
          genChannelId(),
          { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when channel is archived", async () => {
      await archiveChannel(asDb(db), systemId, testChannel.id, auth, noopAudit);

      await assertApiError(
        createMessage(
          asDb(db),
          systemId,
          testChannel.id,
          { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("throws NOT_FOUND when channel is a category", async () => {
      const category = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "category", sortOrder: 0 },
        auth,
        noopAudit,
      );

      await assertApiError(
        createMessage(
          asDb(db),
          systemId,
          category.id,
          { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getMessage", () => {
    it("retrieves a previously created message", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const result = await getMessage(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.channelId).toBe(testChannel.id);
    });

    it("retrieves message with timestamp hint", async () => {
      const ts = Date.now();
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: ts },
        auth,
        noopAudit,
      );

      const result = await getMessage(asDb(db), systemId, created.id, auth, {
        timestamp: ts as UnixMillis,
      });
      expect(result.id).toBe(created.id);
    });

    it("throws NOT_FOUND for non-existent ID", async () => {
      await assertApiError(getMessage(asDb(db), systemId, genMessageId(), auth), "NOT_FOUND", 404);
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listMessages", () => {
    it("lists messages in descending timestamp order", async () => {
      const baseTs = Date.now();
      for (let i = 0; i < 3; i++) {
        await createMessage(
          asDb(db),
          systemId,
          testChannel.id,
          { encryptedData: testEncryptedDataBase64(), timestamp: baseTs + i * 1000 },
          auth,
          noopAudit,
        );
      }

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth);
      expect(result.items).toHaveLength(3);
      // Should be descending by timestamp
      expect(result.items[0]?.timestamp).toBeGreaterThan(result.items[1]?.timestamp ?? 0);
      expect(result.items[1]?.timestamp).toBeGreaterThan(result.items[2]?.timestamp ?? 0);
    });

    it("paginates with cursor", async () => {
      const baseTs = Date.now();
      for (let i = 0; i < 3; i++) {
        await createMessage(
          asDb(db),
          systemId,
          testChannel.id,
          { encryptedData: testEncryptedDataBase64(), timestamp: baseTs + i * 1000 },
          auth,
          noopAudit,
        );
      }

      const page1 = await listMessages(asDb(db), systemId, testChannel.id, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      const page2 = await listMessages(asDb(db), systemId, testChannel.id, auth, {
        cursor: page1.nextCursor ?? "",
        limit: 2,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      // Ensure no overlap
      const allIds = [...page1.items.map((m) => m.id), ...page2.items.map((m) => m.id)];
      expect(new Set(allIds).size).toBe(3);
    });

    it("filters with before timestamp", async () => {
      const baseTs = Date.now();
      await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: baseTs },
        auth,
        noopAudit,
      );
      await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: baseTs + 10_000 },
        auth,
        noopAudit,
      );

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth, {
        before: (baseTs + 5_000) as UnixMillis,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.timestamp).toBe(baseTs);
    });

    it("does not return messages from other channels", async () => {
      const otherChannel = await createChannel(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 1 },
        auth,
        noopAudit,
      );
      await createMessage(
        asDb(db),
        systemId,
        otherChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth);
      expect(result.items).toHaveLength(0);
    });

    it("filters with after timestamp", async () => {
      const baseTs = Date.now();
      await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: baseTs },
        auth,
        noopAudit,
      );
      await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: baseTs + 10_000 },
        auth,
        noopAudit,
      );

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth, {
        after: (baseTs + 5_000) as UnixMillis,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.timestamp).toBe(baseTs + 10_000);
    });

    it("excludes archived messages by default", async () => {
      const msg = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      await archiveMessage(asDb(db), systemId, msg.id, auth, noopAudit);

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth);
      expect(result.items.every((m) => m.id !== msg.id)).toBe(true);
    });

    it("includes archived messages when includeArchived is true", async () => {
      const msg = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      await archiveMessage(asDb(db), systemId, msg.id, auth, noopAudit);

      const result = await listMessages(asDb(db), systemId, testChannel.id, auth, {
        includeArchived: true,
      });
      expect(result.items.some((m) => m.id === msg.id)).toBe(true);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateMessage", () => {
    it("updates on correct version, sets editedAt, increments version", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await updateMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(result.editedAt).not.toBeNull();
      expect(audit.calls[0]?.eventType).toBe("message.updated");
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      await updateMessage(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateMessage(
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

  describe("archiveMessage / restoreMessage", () => {
    it("archives a message so it is no longer returned by get", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      await archiveMessage(asDb(db), systemId, created.id, auth, noopAudit);
      await assertApiError(getMessage(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });

    it("restores an archived message", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      await archiveMessage(asDb(db), systemId, created.id, auth, noopAudit);
      const restored = await restoreMessage(asDb(db), systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
    });
  });

  // ── CROSS-SYSTEM ISOLATION ──────────────────────────────────────

  describe("cross-system isolation", () => {
    it("cannot access another system's message by ID", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const otherSystemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        getMessage(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return another system's messages", async () => {
      await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const otherSystemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const otherAuth = makeAuth(accountId, otherSystemId);

      // Create a channel for the other system to use as a list target
      const otherChannel = await createChannel(
        asDb(db),
        otherSystemId,
        { encryptedData: testEncryptedDataBase64(), type: "channel", sortOrder: 0 },
        otherAuth,
        noopAudit,
      );

      const result = await listMessages(asDb(db), otherSystemId, otherChannel.id, otherAuth);
      expect(result.items).toHaveLength(0);
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deleteMessage", () => {
    it("deletes a message (leaf entity, always deletable)", async () => {
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: Date.now() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteMessage(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getMessage(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("message.deleted");
    });

    it("throws NOT_FOUND for non-existent message", async () => {
      await assertApiError(
        deleteMessage(asDb(db), systemId, genMessageId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("deletes with timestamp hint", async () => {
      const ts = Date.now();
      const created = await createMessage(
        asDb(db),
        systemId,
        testChannel.id,
        { encryptedData: testEncryptedDataBase64(), timestamp: ts },
        auth,
        noopAudit,
      );

      await deleteMessage(asDb(db), systemId, created.id, auth, noopAudit, {
        timestamp: ts as UnixMillis,
      });
      await assertApiError(getMessage(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });
});
