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
} from "../../services/webhook-delivery.service.js";
import { genWebhookDeliveryId, makeAuth, noopAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, WebhookDeliveryId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-delivery.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let webhookId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
    auth = makeAuth(accountId, systemId);

    const wh = await createWebhookConfig(
      db as never,
      systemId as SystemId,
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

  async function insertDelivery(overrides: Record<string, unknown> = {}): Promise<string> {
    const id = genWebhookDeliveryId();
    await db.insert(webhookDeliveries).values({
      id,
      webhookId,
      systemId,
      eventType: "fronting.started",
      status: "pending",
      attemptCount: 0,
      payloadData: {},
      createdAt: Date.now(),
      ...overrides,
    });
    return id;
  }

  describe("listWebhookDeliveries", () => {
    it("returns all deliveries for the system", async () => {
      await insertDelivery();
      await insertDelivery({ status: "success" });

      const result = await listWebhookDeliveries(db as never, systemId as SystemId, auth);
      expect(result.items.length).toBe(2);
    });

    it("filters by webhookId", async () => {
      await insertDelivery();
      const result = await listWebhookDeliveries(db as never, systemId as SystemId, auth, {
        webhookId: webhookId as WebhookId,
      });
      expect(result.items.length).toBe(1);
    });

    it("filters by status", async () => {
      await insertDelivery();
      await insertDelivery({ status: "success" });
      await insertDelivery({ status: "failed" });

      const result = await listWebhookDeliveries(db as never, systemId as SystemId, auth, {
        status: "pending",
      });
      expect(result.items.length).toBe(1);
    });

    it("filters by eventType", async () => {
      await insertDelivery();
      await insertDelivery({ eventType: "fronting.ended" });

      const result = await listWebhookDeliveries(db as never, systemId as SystemId, auth, {
        eventType: "fronting.ended",
      });
      expect(result.items.length).toBe(1);
    });

    it("supports pagination", async () => {
      await insertDelivery();
      await insertDelivery();

      const page1 = await listWebhookDeliveries(db as never, systemId as SystemId, auth, {
        limit: 1,
      });
      expect(page1.items.length).toBe(1);
      expect(page1.hasMore).toBe(true);
    });
  });

  describe("deleteWebhookDelivery", () => {
    it("always succeeds", async () => {
      const id = await insertDelivery();
      await deleteWebhookDelivery(
        db as never,
        systemId as SystemId,
        id as WebhookDeliveryId,
        auth,
        noopAudit,
      );
      await expect(
        getWebhookDelivery(db as never, systemId as SystemId, id as WebhookDeliveryId, auth),
      ).rejects.toThrow("not found");
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await expect(
        deleteWebhookDelivery(
          db as never,
          systemId as SystemId,
          genWebhookDeliveryId() as WebhookDeliveryId,
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("not found");
    });
  });
});
