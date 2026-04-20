import { systemSnapshots } from "@pluralscape/db/pg";
import { pgInsertSystem, testBlob } from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. If you find yourself adding
// new vi.mock() calls in 3+ files, consider whether they belong in shared
// setup. Keep these BEFORE any module-level import that could transitively
// pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));
// `purgeSystem` calls real Argon2id/sodium auth-key verification, which needs
// worker threads and the real authKeyHash bytes — neither is available against
// a PGlite-seeded account whose authKeyHash is zero-filled. Stub the verifier
// so any well-formed hex auth-key string round-trips as valid.
vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return {
    ...actual,
    verifyAuthKey: (): boolean => true,
  };
});

import { systemRouter } from "../../../trpc/routers/system.js";
import { testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  seedAccountAndSystem,
  seedSecondTenant,
  setupRouterIntegration,
  truncateAll,
  type RouterIntegrationCtx,
  type SeededTenant,
} from "../integration-helpers.js";
import { makeIntegrationCallerFactory } from "../test-helpers.js";

import type { SystemSnapshotId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Initial version returned by createSystem; required input for `update`. */
const INITIAL_SYSTEM_VERSION = 1;

/**
 * Hex-encoded 32-byte auth key matching the `authKeyHex` validator
 * (AUTH_KEY_BYTE_LENGTH = 32 → 64 hex chars). The server-side verifier is
 * mocked above to always succeed, so the bytes themselves are inert.
 */
const TEST_AUTH_KEY_HEX = "a".repeat(64);

/**
 * Insert an extra non-archived system on the primary account so `archive`
 * and `purge` don't trip the "cannot delete the only system" guard. The
 * extra system is intentionally NOT added to `auth.ownedSystemIds`; it
 * exists purely as a sibling to satisfy the `systemCount > 1` precondition.
 */
async function seedSiblingSystem(db: PostgresJsDatabase, accountIdRaw: string): Promise<void> {
  const siblingIdRaw = `sys_${crypto.randomUUID()}`;
  await pgInsertSystem(db as never, accountIdRaw, siblingIdRaw);
}

/**
 * Insert a snapshot row owned by the given system so `system.duplicate` can
 * find a source blob. Bypasses the snapshot service path because the router
 * integration suite covers that elsewhere.
 */
async function seedSnapshot(
  db: PostgresJsDatabase,
  systemIdRaw: string,
): Promise<SystemSnapshotId> {
  const snapshotIdRaw = `snap_${crypto.randomUUID()}`;
  const timestamp = Date.now();
  await db.insert(systemSnapshots).values({
    id: snapshotIdRaw,
    systemId: systemIdRaw,
    snapshotTrigger: "manual",
    encryptedData: testBlob(),
    createdAt: timestamp,
  });
  return brandId<SystemSnapshotId>(snapshotIdRaw);
}

describe("system router integration", () => {
  let ctx: RouterIntegrationCtx;
  let makeCaller: ReturnType<typeof makeIntegrationCallerFactory<{ system: typeof systemRouter }>>;
  let primary: SeededTenant;
  let other: SeededTenant;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
    makeCaller = makeIntegrationCallerFactory({ system: systemRouter }, ctx.db);
  });

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    primary = await seedAccountAndSystem(ctx.db);
    other = await seedSecondTenant(ctx.db);
  });

  afterEach(async () => {
    await truncateAll(ctx);
  });

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("system.create", () => {
    it("creates a new system on the caller's account", async () => {
      const caller = makeCaller(primary.auth);
      const result = await caller.system.create();
      expect(result.id).toMatch(/^sys_/);
      // Distinct from the seed system — `create` always mints a fresh id.
      expect(result.id).not.toBe(primary.systemId);
      expect(result.version).toBe(INITIAL_SYSTEM_VERSION);
    });
  });

  describe("system.get", () => {
    it("returns the system profile by id", async () => {
      const caller = makeCaller(primary.auth);
      const result = await caller.system.get({ systemId: primary.systemId });
      expect(result.id).toBe(primary.systemId);
    });
  });

  describe("system.list", () => {
    it("returns systems owned by the caller's account", async () => {
      const caller = makeCaller(primary.auth);
      // listSystems returns PaginatedResult<SystemProfileResult> ⇒ `data`,
      // not `items`. Only the seeded system on `primary.accountId` is visible
      // because RLS scopes by accountId.
      const result = await caller.system.list({});
      expect(result.data.length).toBe(1);
      expect(result.data[0]?.id).toBe(primary.systemId);
    });
  });

  describe("system.update", () => {
    it("updates the system's encrypted profile data", async () => {
      const caller = makeCaller(primary.auth);
      // UpdateSystemBodySchema requires `version` (optimistic concurrency token).
      // Newly seeded systems start at version 1.
      const result = await caller.system.update({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_SYSTEM_VERSION,
      });
      expect(result.id).toBe(primary.systemId);
      expect(result.version).toBe(INITIAL_SYSTEM_VERSION + 1);
    });
  });

  describe("system.archive", () => {
    it("soft-deletes the system when at least one sibling remains active", async () => {
      // archiveSystem refuses to soft-delete the only active system on an
      // account, so a sibling row is required for the happy path.
      await seedSiblingSystem(ctx.db, primary.accountId);
      const caller = makeCaller(primary.auth);
      const result = await caller.system.archive({ systemId: primary.systemId });
      expect(result.success).toBe(true);
    });
  });

  describe("system.duplicate", () => {
    it("creates a new system seeded from an existing snapshot", async () => {
      const snapshotId = await seedSnapshot(ctx.db, primary.systemId);
      const caller = makeCaller(primary.auth);
      const result = await caller.system.duplicate({
        systemId: primary.systemId,
        snapshotId,
      });
      expect(result.id).toMatch(/^sys_/);
      expect(result.id).not.toBe(primary.systemId);
      expect(result.sourceSnapshotId).toBe(snapshotId);
    });
  });

  describe("system.purge", () => {
    it("permanently deletes an archived system without affecting other tenants", async () => {
      // Purge requires the target system to be archived first, and archive
      // requires at least one sibling system on the account.
      await seedSiblingSystem(ctx.db, primary.accountId);
      const caller = makeCaller(primary.auth);
      await caller.system.archive({ systemId: primary.systemId });
      const result = await caller.system.purge({
        systemId: primary.systemId,
        authKey: TEST_AUTH_KEY_HEX,
      });
      expect(result.success).toBe(true);

      // The other tenant's system must remain untouched after the cascade.
      const otherCaller = makeCaller(other.auth);
      const remaining = await otherCaller.system.get({ systemId: other.systemId });
      expect(remaining.id).toBe(other.systemId);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const caller = makeCaller(null);
      await expectAuthRequired(caller.system.list({}));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's system", async () => {
      const caller = makeCaller(primary.auth);
      await expectTenantDenied(caller.system.get({ systemId: other.systemId }));
    });
  });
});
