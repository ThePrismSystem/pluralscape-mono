import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
//
// invalidateWebhookConfigCache is asserted against further down — the
// webhook-config service calls it on every successful mutation to keep the
// in-memory dispatcher cache in sync.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));
// Stub SSRF/IP validation: webhook config create + update + test all call
// resolveAndValidateUrl, which performs a real DNS lookup. Mocking it returns
// a public-looking IP so the production code path runs without network I/O.
vi.mock("../../../lib/ip-validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/ip-validation.js")>();
  return {
    ...actual,
    resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
  };
});

import { createWebhookConfig } from "../../../services/webhook-config.service.js";
import { invalidateWebhookConfigCache } from "../../../services/webhook-dispatcher.js";
import { webhookConfigRouter } from "../../../trpc/routers/webhook-config.js";
import { noopAudit } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { SystemId, WebhookEventType, WebhookId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Initial version returned by createWebhookConfig; required input for `update` and `rotateSecret`. */
const INITIAL_WEBHOOK_VERSION = 1;

/** Default webhook URL for seeding. HTTPS is mandatory unless host is localhost. */
const TEST_WEBHOOK_URL = "https://example.com/webhook";

/**
 * Default event-type subscription used when seeding. Typed as a mutable
 * `WebhookEventType[]` (not `as const`) because Zod-inferred input shapes
 * for create/update reject readonly tuples.
 */
const DEFAULT_EVENT_TYPES: WebhookEventType[] = ["fronting.started"];

/**
 * Seed a webhook config via the real service path. Router-local because
 * webhook-config is the only router that needs it; promote to
 * integration-helpers if a second router starts depending on it.
 */
async function seedWebhookConfig(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<WebhookId> {
  const result = await createWebhookConfig(
    db,
    systemId,
    {
      url: TEST_WEBHOOK_URL,
      eventTypes: DEFAULT_EVENT_TYPES,
      enabled: true,
    },
    auth,
    noopAudit,
  );
  return result.id;
}

describe("webhook-config router integration", () => {
  // Reset the cache-invalidation spy before every test so each block
  // observes only its own mutation calls. Runs FIRST in beforeEach via
  // the fixture's clearMocks hook, before tenant seeding.
  const fixture = setupRouterFixture(
    { webhookConfig: webhookConfigRouter },
    {
      clearMocks: () => {
        vi.mocked(invalidateWebhookConfigCache).mockClear();
      },
    },
  );

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("webhookConfig.create", () => {
    it("creates a webhook config and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.webhookConfig.create({
        systemId: primary.systemId,
        url: TEST_WEBHOOK_URL,
        eventTypes: DEFAULT_EVENT_TYPES,
        enabled: true,
        // optionalBrandedId returns `T | undefined`, which TS infers as a
        // required property whose value may be undefined — so we must pass it.
        cryptoKeyId: undefined,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^wh_/);
      // create returns the raw secret exactly once for the caller to store.
      expect(typeof result.secret).toBe("string");
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.get", () => {
    it("returns a webhook config by id", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.webhookConfig.get({
        systemId: primary.systemId,
        webhookId,
      });
      expect(result.id).toBe(webhookId);
    });
  });

  describe("webhookConfig.list", () => {
    it("returns webhook configs of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedWebhookConfig(db, primary.systemId, primary.auth);
      await seedWebhookConfig(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // listWebhookConfigs returns PaginatedResult<WebhookConfigResult> ⇒ `data`, not `items`.
      const result = await caller.webhookConfig.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("webhookConfig.update", () => {
    it("updates a webhook config and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      // Clear any prior invalidation calls (seed went through createWebhookConfig).
      vi.mocked(invalidateWebhookConfigCache).mockClear();
      // UpdateWebhookConfigBodySchema requires `version` (optimistic concurrency token).
      const result = await caller.webhookConfig.update({
        systemId: primary.systemId,
        webhookId,
        enabled: false,
        version: INITIAL_WEBHOOK_VERSION,
      });
      expect(result.id).toBe(webhookId);
      expect(result.enabled).toBe(false);
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.delete", () => {
    it("deletes a webhook config and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      vi.mocked(invalidateWebhookConfigCache).mockClear();
      const result = await caller.webhookConfig.delete({
        systemId: primary.systemId,
        webhookId,
      });
      expect(result.success).toBe(true);
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.archive", () => {
    it("archives a webhook config and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      vi.mocked(invalidateWebhookConfigCache).mockClear();
      const result = await caller.webhookConfig.archive({
        systemId: primary.systemId,
        webhookId,
      });
      expect(result.success).toBe(true);
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.restore", () => {
    it("restores an archived webhook config and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      await caller.webhookConfig.archive({
        systemId: primary.systemId,
        webhookId,
      });
      vi.mocked(invalidateWebhookConfigCache).mockClear();
      const restored = await caller.webhookConfig.restore({
        systemId: primary.systemId,
        webhookId,
      });
      expect(restored.id).toBe(webhookId);
      expect(restored.archived).toBe(false);
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.rotateSecret", () => {
    it("rotates the secret, returns a fresh value, and invalidates the dispatcher cache", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      vi.mocked(invalidateWebhookConfigCache).mockClear();
      // RotateWebhookSecretBodySchema requires the current OCC version (≥1).
      const result = await caller.webhookConfig.rotateSecret({
        systemId: primary.systemId,
        webhookId,
        version: INITIAL_WEBHOOK_VERSION,
      });
      expect(result.id).toBe(webhookId);
      // rotateWebhookSecret returns the same WebhookConfigCreateResult shape as
      // create — the new raw secret is exposed exactly once.
      expect(typeof result.secret).toBe("string");
      expect(vi.mocked(invalidateWebhookConfigCache)).toHaveBeenCalledWith(primary.systemId);
    });
  });

  describe("webhookConfig.test", () => {
    it("returns a WebhookTestResult for a synthetic delivery attempt", async () => {
      const primary = fixture.getPrimary();
      const webhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        primary.systemId,
        primary.auth,
      );
      // Stub global fetch so the test ping doesn't hit the real network.
      // testWebhookConfig in the router uses default fetch (not injected via
      // input), so global stubbing is the only seam.
      const fetchStub = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
      vi.stubGlobal("fetch", fetchStub);
      try {
        const caller = fixture.getCaller(primary.auth);
        const result = await caller.webhookConfig.test({
          systemId: primary.systemId,
          webhookId,
        });
        // Whether this returns success=true depends on the SSRF + signed-fetch
        // pipeline succeeding end-to-end. We assert only the result shape so
        // the test stays stable across signed-fetch refactors; success-path
        // behaviour is exercised in webhook-config.service.integration.test.ts.
        expect(typeof result.success).toBe("boolean");
        expect(typeof result.durationMs).toBe("number");
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.webhookConfig.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's webhook config", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherWebhookId = await seedWebhookConfig(
        fixture.getCtx().db,
        other.systemId,
        other.auth,
      );
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.webhookConfig.get({
          systemId: other.systemId,
          webhookId: otherWebhookId,
        }),
      );
    });
  });
});
