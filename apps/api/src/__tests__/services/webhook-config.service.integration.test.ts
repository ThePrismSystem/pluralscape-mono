import { PGlite } from "@electric-sql/pglite";
import { accounts, apiKeys, systems, webhookConfigs, webhookDeliveries } from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveWebhookConfig,
  createWebhookConfig,
  deleteWebhookConfig,
  getWebhookConfig,
  restoreWebhookConfig,
  updateWebhookConfig,
} from "../../services/webhook-config.service.js";
import { genWebhookId, makeAuth, noopAudit } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, WebhookId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys, webhookConfigs, webhookDeliveries };

describe("webhook-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
  });

  function createParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      url: "https://example.com/webhook",
      eventTypes: ["fronting.started"],
      enabled: true,
      ...overrides,
    };
  }

  describe("createWebhookConfig", () => {
    it("generates a secret in the response", async () => {
      const result = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      expect(result.id).toMatch(/^wh_/);
      expect(result.secret).toBeTruthy();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.url).toBe("https://example.com/webhook");
    });

    it("validates event types", async () => {
      await expect(
        createWebhookConfig(
          db as never,
          systemId as SystemId,
          createParams({ eventTypes: ["invalid.event"] }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });

    it("validates URL format", async () => {
      await expect(
        createWebhookConfig(
          db as never,
          systemId as SystemId,
          createParams({ url: "not-a-url" }),
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });
  });

  describe("getWebhookConfig", () => {
    it("secret is NOT in the response", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await getWebhookConfig(db as never, systemId as SystemId, created.id, auth);
      expect(result.id).toBe(created.id);
      // The get endpoint uses WEBHOOK_CONFIG_SELECT_COLUMNS which excludes secret
      expect("secret" in result).toBe(false);
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await expect(
        getWebhookConfig(db as never, systemId as SystemId, genWebhookId() as WebhookId, auth),
      ).rejects.toThrow("not found");
    });
  });

  describe("updateWebhookConfig", () => {
    it("updates on correct version (OCC)", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await updateWebhookConfig(
        db as never,
        systemId as SystemId,
        created.id,
        { version: 1, enabled: false },
        auth,
        noopAudit,
      );
      expect(result.version).toBe(2);
      expect(result.enabled).toBe(false);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await updateWebhookConfig(
        db as never,
        systemId as SystemId,
        created.id,
        { version: 1, enabled: false },
        auth,
        noopAudit,
      );

      await expect(
        updateWebhookConfig(
          db as never,
          systemId as SystemId,
          created.id,
          { version: 1, enabled: true },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Version conflict");
    });

    it("re-validates URL on update", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await expect(
        updateWebhookConfig(
          db as never,
          systemId as SystemId,
          created.id,
          { version: 1, url: "not-a-url" },
          auth,
          noopAudit,
        ),
      ).rejects.toThrow("Invalid payload");
    });
  });

  describe("deleteWebhookConfig", () => {
    it("deletes with no pending deliveries", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await deleteWebhookConfig(db as never, systemId as SystemId, created.id, auth, noopAudit);
      await expect(
        getWebhookConfig(db as never, systemId as SystemId, created.id, auth),
      ).rejects.toThrow("not found");
    });

    it("throws HAS_DEPENDENTS with pending deliveries", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await db.insert(webhookDeliveries).values({
        id: `wd_${crypto.randomUUID()}`,
        webhookId: created.id,
        systemId,
        eventType: "fronting.started",
        status: "pending",
        attemptCount: 0,
        payloadData: {},
        createdAt: Date.now(),
      });

      await expect(
        deleteWebhookConfig(db as never, systemId as SystemId, created.id, auth, noopAudit),
      ).rejects.toThrow("pending delivery");
    });
  });

  describe("archiveWebhookConfig / restoreWebhookConfig", () => {
    it("archives and restores", async () => {
      const created = await createWebhookConfig(
        db as never,
        systemId as SystemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveWebhookConfig(db as never, systemId as SystemId, created.id, auth, noopAudit);

      await expect(
        getWebhookConfig(db as never, systemId as SystemId, created.id, auth),
      ).rejects.toThrow("not found");

      const restored = await restoreWebhookConfig(
        db as never,
        systemId as SystemId,
        created.id,
        auth,
        noopAudit,
      );
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });
});
