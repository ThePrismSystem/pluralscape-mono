import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createWebhookConfig } from "../../services/webhook-config/create.js";
import {
  deleteWebhookDelivery,
  getWebhookDelivery,
  listWebhookDeliveries,
  parseWebhookDeliveryQuery,
} from "../../services/webhook-delivery.service.js";
import {
  asDb,
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

const { webhookDeliveries } = schema;

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
    const accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);

    const wh = await createWebhookConfig(
      asDb(db),
      systemId,
      {
        url: "https://example.com/hook",
        eventTypes: ["fronting.started", "fronting.ended"],
        enabled: true,
        cryptoKeyId: undefined,
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
      encryptedData: new Uint8Array([1, 2, 3]),
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

      const result = await listWebhookDeliveries(asDb(db), systemId, auth);
      expect(result.data.length).toBe(2);
    });

    it("filters by webhookId", async () => {
      await insertDelivery();
      const result = await listWebhookDeliveries(asDb(db), systemId, auth, {
        webhookId,
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.webhookId).toBe(webhookId);
    });

    it("filters by status", async () => {
      await insertDelivery();
      await insertDelivery({ status: "success" });
      await insertDelivery({ status: "failed" });

      const result = await listWebhookDeliveries(asDb(db), systemId, auth, {
        status: "pending",
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.status).toBe("pending");
    });

    it("filters by eventType", async () => {
      await insertDelivery();
      await insertDelivery({ eventType: "fronting.ended" });

      const result = await listWebhookDeliveries(asDb(db), systemId, auth, {
        eventType: "fronting.ended",
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.eventType).toBe("fronting.ended");
    });

    it("supports pagination", async () => {
      await insertDelivery();
      await insertDelivery();

      const page1 = await listWebhookDeliveries(asDb(db), systemId, auth, {
        limit: 1,
      });
      expect(page1.data.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listWebhookDeliveries(asDb(db), systemId, auth, {
        cursor: page1.data[0]?.id,
        limit: 1,
      });
      expect(page2.data.length).toBe(1);
      expect(page2.data[0]?.id).not.toBe(page1.data[0]?.id);
    });
  });

  describe("deleteWebhookDelivery", () => {
    it("deletes and audits", async () => {
      const id = await insertDelivery();
      const audit = spyAudit();
      await deleteWebhookDelivery(asDb(db), systemId, id, auth, audit);
      await assertApiError(getWebhookDelivery(asDb(db), systemId, id, auth), "NOT_FOUND", 404);
      expect(audit.calls.length).toBe(1);
      expect(audit.calls[0]?.eventType).toBe("webhook-delivery.deleted");
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        deleteWebhookDelivery(asDb(db), systemId, genWebhookDeliveryId(), auth, noopAudit),
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
