import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/ip-validation.js", () => ({
  resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
}));

import { WEBHOOK_SECRET_BYTES } from "../../service.constants.js";
import {
  archiveWebhookConfig,
  createWebhookConfig,
  deleteWebhookConfig,
  getWebhookConfig,
  listWebhookConfigs,
  parseWebhookConfigQuery,
  restoreWebhookConfig,
  updateWebhookConfig,
} from "../../services/webhook-config.service.js";
import {
  asDb,
  assertApiError,
  genWebhookId,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { webhookConfigs, webhookDeliveries } = schema;

describe("webhook-config.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgWebhookTables(client);
    const accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(webhookDeliveries);
    await db.delete(webhookConfigs);
  });

  function createParams(
    overrides: Partial<{
      url: string;
      eventTypes: string[];
      enabled: boolean;
      cryptoKeyId: string;
    }> = {},
  ) {
    return {
      url: "https://example.com/webhook",
      eventTypes: ["fronting.started"],
      enabled: true,
      ...overrides,
    };
  }

  describe("createWebhookConfig", () => {
    it("generates a secret in the response", async () => {
      const audit = spyAudit();
      const result = await createWebhookConfig(asDb(db), systemId, createParams(), auth, audit);
      expect(result.id).toMatch(/^wh_/);
      // WEBHOOK_SECRET_BYTES=32, base64-encoded = 44 chars
      const expectedBase64Length = Math.ceil(WEBHOOK_SECRET_BYTES / 3) * 4;
      expect(result.secret).toHaveLength(expectedBase64Length);
      expect(result.url).toBe("https://example.com/webhook");
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("webhook-config.created");
    });

    it("validates event types", async () => {
      await assertApiError(
        createWebhookConfig(
          asDb(db),
          systemId,
          createParams({ eventTypes: ["invalid.event"] }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });

    it("validates URL format", async () => {
      await assertApiError(
        createWebhookConfig(
          asDb(db),
          systemId,
          createParams({ url: "not-a-url" }),
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("getWebhookConfig", () => {
    it("secret is NOT in the response", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await getWebhookConfig(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      // The get endpoint uses WEBHOOK_CONFIG_SELECT_COLUMNS which excludes secret
      expect("secret" in result).toBe(false);
    });

    it("throws NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        getWebhookConfig(asDb(db), systemId, genWebhookId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("updateWebhookConfig", () => {
    it("updates on correct version (OCC)", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const result = await updateWebhookConfig(
        asDb(db),
        systemId,
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
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await updateWebhookConfig(
        asDb(db),
        systemId,
        created.id,
        { version: 1, enabled: false },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateWebhookConfig(
          asDb(db),
          systemId,
          created.id,
          { version: 1, enabled: true },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });

    it("re-validates URL on update", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await assertApiError(
        updateWebhookConfig(
          asDb(db),
          systemId,
          created.id,
          { version: 1, url: "not-a-url" },
          auth,
          noopAudit,
        ),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  describe("deleteWebhookConfig", () => {
    it("deletes with no pending deliveries", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await deleteWebhookConfig(asDb(db), systemId, created.id, auth, noopAudit);
      await assertApiError(
        getWebhookConfig(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("throws HAS_DEPENDENTS with pending deliveries", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
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

      await assertApiError(
        deleteWebhookConfig(asDb(db), systemId, created.id, auth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });
  });

  describe("archiveWebhookConfig / restoreWebhookConfig", () => {
    it("archives and restores", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await archiveWebhookConfig(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        getWebhookConfig(asDb(db), systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );

      const restored = await restoreWebhookConfig(asDb(db), systemId, created.id, auth, noopAudit);
      expect(restored.archived).toBe(false);
      expect(restored.version).toBe(3);
    });
  });

  describe("listWebhookConfigs", () => {
    it("returns all configs for the system", async () => {
      await createWebhookConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await createWebhookConfig(
        asDb(db),
        systemId,
        createParams({ url: "https://example.com/hook2" }),
        auth,
        noopAudit,
      );
      const result = await listWebhookConfigs(asDb(db), systemId, auth);
      expect(result.items.length).toBe(2);
    });

    it("supports pagination", async () => {
      await createWebhookConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await createWebhookConfig(
        asDb(db),
        systemId,
        createParams({ url: "https://example.com/hook2" }),
        auth,
        noopAudit,
      );

      const page1 = await listWebhookConfigs(asDb(db), systemId, auth, { limit: 1 });
      expect(page1.items.length).toBe(1);
      expect(page1.hasMore).toBe(true);

      const page2 = await listWebhookConfigs(asDb(db), systemId, auth, {
        cursor: page1.items[0]?.id,
        limit: 1,
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
    });

    it("excludes archived by default", async () => {
      const wh = await createWebhookConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveWebhookConfig(asDb(db), systemId, wh.id, auth, noopAudit);
      const result = await listWebhookConfigs(asDb(db), systemId, auth);
      expect(result.items.length).toBe(0);
    });

    it("includes archived when requested", async () => {
      const wh = await createWebhookConfig(asDb(db), systemId, createParams(), auth, noopAudit);
      await archiveWebhookConfig(asDb(db), systemId, wh.id, auth, noopAudit);
      const result = await listWebhookConfigs(asDb(db), systemId, auth, {
        includeArchived: true,
      });
      expect(result.items.length).toBe(1);
    });
  });

  describe("parseWebhookConfigQuery", () => {
    it("returns defaults for empty query", () => {
      const result = parseWebhookConfigQuery({});
      expect(result).toEqual({ includeArchived: false });
    });

    it("parses includeArchived", () => {
      const result = parseWebhookConfigQuery({ includeArchived: "true" });
      expect(result.includeArchived).toBe(true);
    });
  });
});
