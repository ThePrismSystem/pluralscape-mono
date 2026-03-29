import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgWebhookTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/ip-validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ip-validation.js")>();
  return {
    ...actual,
    resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
  };
});

import { WEBHOOK_SECRET_BYTES } from "../../service.constants.js";
import {
  archiveWebhookConfig,
  createWebhookConfig,
  deleteWebhookConfig,
  getWebhookConfig,
  listWebhookConfigs,
  parseWebhookConfigQuery,
  restoreWebhookConfig,
  rotateWebhookSecret,
  testWebhookConfig,
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

    it("rejects creation when at per-system quota limit", async () => {
      const QUOTA_LIMIT = 25;
      // Bulk-insert configs to fill the quota
      const values = Array.from({ length: QUOTA_LIMIT }, (_, i) => ({
        id: `wh_quota-${String(i).padStart(3, "0")}-${crypto.randomUUID()}`,
        systemId,
        url: `https://example.com/hook-${String(i)}`,
        secret: Buffer.from("test-secret-key-pad-to-32-bytes!"),
        eventTypes: ["fronting.started" as const],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      await db.insert(webhookConfigs).values(values);

      await assertApiError(
        createWebhookConfig(asDb(db), systemId, createParams(), auth, noopAudit),
        "QUOTA_EXCEEDED",
        429,
        "Maximum of 25 webhook configs per system",
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

    it("rejects restore when active configs are at quota limit", async () => {
      const QUOTA_LIMIT = 25;
      // Create one config and archive it
      const toArchive = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams({ url: "https://example.com/archived" }),
        auth,
        noopAudit,
      );
      await archiveWebhookConfig(asDb(db), systemId, toArchive.id, auth, noopAudit);

      // Fill the quota with new active configs
      const values = Array.from({ length: QUOTA_LIMIT }, (_, i) => ({
        id: `wh_rq-${String(i).padStart(3, "0")}-${crypto.randomUUID().slice(0, 8)}`,
        systemId,
        url: `https://example.com/restore-hook-${String(i)}`,
        secret: Buffer.from("test-secret-key-pad-to-32-bytes!"),
        eventTypes: ["fronting.started" as const],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      await db.insert(webhookConfigs).values(values);

      // Restoring the archived config should exceed quota
      await assertApiError(
        restoreWebhookConfig(asDb(db), systemId, toArchive.id, auth, noopAudit),
        "QUOTA_EXCEEDED",
        429,
      );
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

  describe("rotateWebhookSecret", () => {
    it("rotates secret and increments version", async () => {
      const audit = spyAudit();
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const rotated = await rotateWebhookSecret(
        asDb(db),
        systemId,
        created.id,
        { version: 1 },
        auth,
        audit,
      );

      expect(rotated.version).toBe(2);
      expect(rotated.secret).toBeDefined();
      expect(rotated.secret).not.toBe(created.secret);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("webhook-config.secret-rotated");
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      await rotateWebhookSecret(asDb(db), systemId, created.id, { version: 1 }, auth, noopAudit);

      await assertApiError(
        rotateWebhookSecret(asDb(db), systemId, created.id, { version: 1 }, auth, noopAudit),
        "CONFLICT",
        409,
      );
    });

    it("throws NOT_FOUND for nonexistent config", async () => {
      await assertApiError(
        rotateWebhookSecret(asDb(db), systemId, genWebhookId(), { version: 1 }, auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("testWebhookConfig", () => {
    it("returns success for 200 response", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const result = await testWebhookConfig(
        asDb(db),
        systemId,
        created.id,
        auth,
        mockFetch as never,
      );

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.error).toBeNull();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns failure for 500 response", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      const mockFetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

      const result = await testWebhookConfig(
        asDb(db),
        systemId,
        created.id,
        auth,
        mockFetch as never,
      );

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(500);
    });

    it("returns error for network failure", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      const result = await testWebhookConfig(
        asDb(db),
        systemId,
        created.id,
        auth,
        mockFetch as never,
      );

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBeNull();
      expect(result.error).toBe("Webhook endpoint request failed (network error)");
    });

    it("throws NOT_FOUND for nonexistent config", async () => {
      await assertApiError(
        testWebhookConfig(asDb(db), systemId, genWebhookId(), auth),
        "NOT_FOUND",
        404,
      );
    });

    it("returns SSRF error when URL validation rejects", async () => {
      const created = await createWebhookConfig(
        asDb(db),
        systemId,
        createParams(),
        auth,
        noopAudit,
      );

      const { resolveAndValidateUrl } = await import("../../lib/ip-validation.js");
      vi.mocked(resolveAndValidateUrl)
        .mockRejectedValueOnce(new Error("private IP"))
        // Restore default for subsequent tests
        .mockResolvedValue(["93.184.216.34"]);

      const result = await testWebhookConfig(asDb(db), systemId, created.id, auth);

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBeNull();
      expect(result.error).toContain("SSRF validation failed");
      expect(result.error).toContain("private IP");
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
