import { describe, expect, it, vi } from "vitest";

// Hoisted mocks for dispatch-style external services. Same block as the
// canonical member router integration test — keep BEFORE any module-level
// import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { createImportJob } from "../../../services/import-job.service.js";
import { importJobRouter } from "../../../trpc/routers/import-job.js";
import { noopAudit } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ImportCollectionType, ImportJobId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Default `selectedCategories` shape used when seeding an import job. Every
 * key in `IMPORT_COLLECTION_TYPES` is materialised explicitly because the
 * tRPC input type infers as `Record<ImportCollectionType, boolean | undefined>`
 * (full record, optional values) rather than `Partial<Record<…>>`, and a
 * partial-record literal fails the full-key requirement at the input boundary.
 *
 * Picks `member` as the single enabled collection so the canonical-order
 * resolver in `firstSelectedCollection` is deterministic.
 *
 * `satisfies` (without `as`) verifies every `IMPORT_COLLECTION_TYPES` key is
 * present without widening the literal — TypeScript will fail this declaration
 * if a new collection type is added to the SSOT tuple but not listed here.
 */
const SEED_SELECTED_CATEGORIES = {
  member: true,
  group: false,
  "custom-front": false,
  "fronting-session": false,
  "fronting-comment": false,
  switch: false,
  "custom-field": false,
  "field-definition": false,
  "field-value": false,
  note: false,
  "journal-entry": false,
  "chat-message": false,
  "board-message": false,
  "channel-category": false,
  channel: false,
  poll: false,
  timer: false,
  "privacy-bucket": false,
  "system-profile": false,
  "system-settings": false,
} as const satisfies Record<ImportCollectionType, boolean | undefined>;

/**
 * Seed an import job via the real `createImportJob` service path. Kept local
 * to this test file because no other router test needs an import job; if a
 * second caller surfaces, promote to `integration-helpers.ts`.
 *
 * Defaults to a `simply-plural` source with `avatarMode: "skip"` and a single
 * selected collection — the minimal valid happy-path shape. The job lands in
 * `status: "pending"` with `progressPercent: 0`. State transitions are
 * exercised by `concurrent-guard-semantics.integration.test.ts`; this file
 * only verifies router wiring + auth + tenant isolation.
 */
async function seedImportJob(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<ImportJobId> {
  const result = await createImportJob(
    db,
    systemId,
    {
      source: "simply-plural",
      selectedCategories: SEED_SELECTED_CATEGORIES,
      avatarMode: "skip",
    },
    auth,
    noopAudit,
  );
  return result.id;
}

describe("import-job router integration", () => {
  const fixture = setupRouterFixture({ importJob: importJobRouter });

  // ── Happy path: one test per procedure ─────────────────────────────

  describe("importJob.create", () => {
    it("creates an import job belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.importJob.create({
        systemId: primary.systemId,
        source: "simply-plural",
        selectedCategories: SEED_SELECTED_CATEGORIES,
        avatarMode: "skip",
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^ij_/);
      expect(result.status).toBe("pending");
    });
  });

  describe("importJob.get", () => {
    it("returns an import job by id", async () => {
      const primary = fixture.getPrimary();
      const importJobId = await seedImportJob(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.importJob.get({
        systemId: primary.systemId,
        importJobId,
      });
      expect(result.id).toBe(importJobId);
    });
  });

  describe("importJob.list", () => {
    it("returns import jobs of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedImportJob(db, primary.systemId, primary.auth);
      await seedImportJob(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // listImportJobs returns PaginatedResult<ImportJobResult>
      // ⇒ `data`, not `items`.
      const result = await caller.importJob.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("importJob.update", () => {
    it("updates an import job's progress", async () => {
      const primary = fixture.getPrimary();
      const importJobId = await seedImportJob(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      // UpdateImportJobBodySchema has no `version` token — the row is locked
      // SELECT … FOR UPDATE inside the transaction. A bare progress bump on
      // a same-state (`pending → pending`) update bypasses the transition
      // guard entirely; full state-machine coverage lives in
      // `concurrent-guard-semantics.integration.test.ts`.
      const result = await caller.importJob.update({
        systemId: primary.systemId,
        importJobId,
        progressPercent: 25,
      });
      expect(result.id).toBe(importJobId);
      expect(result.progressPercent).toBe(25);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.importJob.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's import job", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherJobId = await seedImportJob(fixture.getCtx().db, other.systemId, other.auth);
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.importJob.get({
          systemId: other.systemId,
          importJobId: otherJobId,
        }),
      );
    });
  });
});
