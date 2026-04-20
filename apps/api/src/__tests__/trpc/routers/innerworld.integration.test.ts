import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { innerworldRouter } from "../../../trpc/routers/innerworld.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  setupRouterFixture,
} from "../integration-helpers.js";

/** Initial version returned by createEntity / createRegion; required input for `update`. */
const INITIAL_VERSION = 1;

/**
 * Canvas upsert is special: when no canvas row exists for the system, the first
 * write must be `version: 1` (the service treats it as an initial insert and
 * rejects any other value with NOT_FOUND).
 */
const INITIAL_CANVAS_VERSION = 1;

describe("innerworld router integration", () => {
  const fixture = setupRouterFixture({ innerworld: innerworldRouter });

  // ── Entity CRUD happy paths ────────────────────────────────────────

  describe("innerworld.entity.create", () => {
    it("creates an entity belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^iwe_/);
    });
  });

  describe("innerworld.entity.get", () => {
    it("returns an entity by id", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.entity.get({
        systemId: primary.systemId,
        entityId: created.id,
      });
      expect(result.id).toBe(created.id);
    });
  });

  describe("innerworld.entity.list", () => {
    it("returns entities of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      // listEntities returns PaginatedResult<EntityResult> ⇒ `data`, not `items`.
      const result = await caller.innerworld.entity.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("innerworld.entity.update", () => {
    it("updates an entity's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      // UpdateEntityBodySchema requires `version` (optimistic concurrency token).
      // Newly created entities start at version 1.
      const result = await caller.innerworld.entity.update({
        systemId: primary.systemId,
        entityId: created.id,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_VERSION,
      });
      expect(result.id).toBe(created.id);
    });
  });

  describe("innerworld.entity.archive", () => {
    it("archives an entity", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.entity.archive({
        systemId: primary.systemId,
        entityId: created.id,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("innerworld.entity.restore", () => {
    it("restores an archived entity", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      await caller.innerworld.entity.archive({
        systemId: primary.systemId,
        entityId: created.id,
      });
      const restored = await caller.innerworld.entity.restore({
        systemId: primary.systemId,
        entityId: created.id,
      });
      expect(restored.id).toBe(created.id);
      expect(restored.archived).toBe(false);
    });
  });

  describe("innerworld.entity.delete", () => {
    it("deletes an entity", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.entity.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.entity.delete({
        systemId: primary.systemId,
        entityId: created.id,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Region CRUD happy paths ────────────────────────────────────────

  describe("innerworld.region.create", () => {
    it("creates a region belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^iwr_/);
    });
  });

  describe("innerworld.region.get", () => {
    it("returns a region by id", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.region.get({
        systemId: primary.systemId,
        regionId: created.id,
      });
      expect(result.id).toBe(created.id);
    });
  });

  describe("innerworld.region.list", () => {
    it("returns regions of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      // listRegions returns PaginatedResult<RegionResult> ⇒ `data`, not `items`.
      const result = await caller.innerworld.region.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("innerworld.region.update", () => {
    it("updates a region's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      // UpdateRegionBodySchema requires `version` (optimistic concurrency token).
      const result = await caller.innerworld.region.update({
        systemId: primary.systemId,
        regionId: created.id,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_VERSION,
      });
      expect(result.id).toBe(created.id);
    });
  });

  describe("innerworld.region.archive", () => {
    it("archives a region", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.region.archive({
        systemId: primary.systemId,
        regionId: created.id,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("innerworld.region.restore", () => {
    it("restores an archived region", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      await caller.innerworld.region.archive({
        systemId: primary.systemId,
        regionId: created.id,
      });
      const restored = await caller.innerworld.region.restore({
        systemId: primary.systemId,
        regionId: created.id,
      });
      expect(restored.id).toBe(created.id);
      expect(restored.archived).toBe(false);
    });
  });

  describe("innerworld.region.delete", () => {
    it("deletes a region", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const created = await caller.innerworld.region.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const result = await caller.innerworld.region.delete({
        systemId: primary.systemId,
        regionId: created.id,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Canvas (system-scoped, no parent entity) ───────────────────────

  describe("innerworld.canvas.upsert", () => {
    it("creates a canvas on first write with version=1", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      // upsertCanvas treats the first write as an INSERT and *requires*
      // version === 1 (any other value yields NOT_FOUND).
      const result = await caller.innerworld.canvas.upsert({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_CANVAS_VERSION,
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.version).toBe(INITIAL_CANVAS_VERSION);
    });
  });

  describe("innerworld.canvas.get", () => {
    it("returns the canvas after it has been created", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      await caller.innerworld.canvas.upsert({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_CANVAS_VERSION,
      });
      const result = await caller.innerworld.canvas.get({ systemId: primary.systemId });
      expect(result.systemId).toBe(primary.systemId);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.innerworld.entity.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's entity", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherCaller = fixture.getCaller(other.auth);
      const otherEntity = await otherCaller.innerworld.entity.create({
        systemId: other.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.innerworld.entity.get({
          systemId: other.systemId,
          entityId: otherEntity.id,
        }),
      );
    });
  });
});
