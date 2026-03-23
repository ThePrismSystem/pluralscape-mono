import { PGlite } from "@electric-sql/pglite";
import { accounts, apiKeys, systems, webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createWebhookConfig } from "../../services/webhook-config.service.js";
import {
  deleteWebhookDelivery,
  getWebhookDelivery,
  listWebhookDeliveries,
  parseWebhookDeliveryQuery,
} from "../../services/webhook-delivery.service.js";
import {
  assertApiError,
  genWebhookDeliveryId,
  genWebhookId,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId, WebhookDeliveryId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-delivery.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let webhookId: WebhookId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);

    const wh = await createWebhookConfig(
      db as never,
      systemId,
      {
        url: "https://example.com/hook",
        eventTypes: ["fronting.started", "fronting.ended"],
      },
      auth,
      noopAudit,
    );
    webhookId = wh.id;
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(webhookDeliveries);
  });

  async function insertDelivery(
    overrides: Record<string, unknown> = {},
  ): Promise<WebhookDeliveryId> {
    const id = genWebhookDeliveryId();
    const values = {
      id,
      webhookId,
      systemId,
      eventType: "fronting.started" as const,
      status: "pending" as const,
      attemptCount: 0,
      payloadData: {},
      createdAt: Date.now(),
      ...overrides,
    };
    await db.insert(webhookDeliveries).values(values as typeof webhookDeliveries.$inferInsert);
    return id;
  }

  describe("listWebhookDeliveries", () => {
    it("returns all deliveries for the system", async () => {
      await insertDelivery();
      await insertDelivery({ status: "success" });

      const result = await listWebhookDeliveries(db as never, systemId, auth);
      expect(result.items.length).toBe(2);
    });

    it("filters by webhookId", async () => {
      await insertDelivery();
      const result = await listWebhookDeliveries(db as never, systemId, auth, {
        webhookId,
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.webhookId).toBe(webhookId);
    });

    it("filters by status", async () => {
      await insertDelivery();
      await insertDelivery({ status: "success" });
      await insertDelivery({ status: "failed" });

      const result = await listWebhookDeliveries(db as never, systemId, auth, {
        status: "pending",
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.status).toBe("pending");
    });

    it("filters by eventType", async () => {
      await insertDelivery();
      await insertDelivery({ eventType: "fronting.ended" });

      const result = await listWebhookDeliveries(db as never, systemId, auth, {
        eventType: "fronting.ended",
      });
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.eventType).toBe("fronting.ended");
    });

    it("supports pagination", async () => {
      await insertDelivery();
      await insertDelivery();

      const page1 = await listWebhookDeliveries(db as never, systemId, auth, {
        limit: 1,
      });
      expect(page1.items.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listWebhookDeliveries(db as never, systemId, auth, {
        cursor: page1.items[0]?.id,
        limit: 1,
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });
  });

  describe("deleteWebhookDelivery", () => {
    it("deletes and audits", async () => {
      const id = await insertDelivery();
      const audit = spyAudit();
      await deleteWebhookDelivery(db as never, systemId, id, auth, audit);
      await assertApiError(getWebhookDelivery(db as never, systemId, id, auth), "NOT_FOUND", 404);
      expect(audit.calls.length).toBe(1);
      expect(audit.calls[0]?.eventType).toBe("webhook-delivery.deleted");
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        deleteWebhookDelivery(db as never, systemId, genWebhookDeliveryId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("parseWebhookDeliveryQuery", () => {
    it("returns defaults for empty query", () => {
      const result = parseWebhookDeliveryQuery({});
      expect(result).toEqual({});
    });

    it("parses webhookId filter", () => {
      const id = genWebhookId();
      const result = parseWebhookDeliveryQuery({ webhookId: id });
      expect(result.webhookId).toBe(id);
    });

    it("parses status filter", () => {
      const result = parseWebhookDeliveryQuery({ status: "pending" });
      expect(result.status).toBe("pending");
    });
  });
});
