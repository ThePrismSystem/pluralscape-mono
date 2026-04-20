import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

import { createNote } from "../../../services/note.service.js";
import { noteRouter } from "../../../trpc/routers/note.js";
import { noopAudit, testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
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

import type { AuthContext } from "../../../lib/auth-context.js";
import type { NoteId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Initial version returned by createNote; required input for `update`. */
const INITIAL_NOTE_VERSION = 1;

/**
 * Seed a note via the real `createNote` service path. Kept local to this
 * test file because no other router test needs it; if a second caller
 * surfaces, promote to `integration-helpers.ts`.
 *
 * Defaults to a system-wide note (no author entity) — the simplest happy-
 * path shape that exercises the same insert path as authored notes.
 */
async function seedNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<NoteId> {
  const result = await createNote(
    db,
    systemId,
    { encryptedData: testEncryptedDataBase64() },
    auth,
    noopAudit,
  );
  return result.id;
}

describe("note router integration", () => {
  let ctx: RouterIntegrationCtx;
  let makeCaller: ReturnType<typeof makeIntegrationCallerFactory<{ note: typeof noteRouter }>>;
  let primary: SeededTenant;
  let other: SeededTenant;

  beforeAll(async () => {
    ctx = await setupRouterIntegration();
    makeCaller = makeIntegrationCallerFactory({ note: noteRouter }, ctx.db);
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

  describe("note.create", () => {
    it("creates a note belonging to the caller's system", async () => {
      const caller = makeCaller(primary.auth);
      const result = await caller.note.create({
        systemId: primary.systemId,
        encryptedData: testEncryptedDataBase64(),
      });
      expect(result.systemId).toBe(primary.systemId);
      expect(result.id).toMatch(/^note_/);
      // No `author` supplied ⇒ system-wide note (both author fields null).
      expect(result.authorEntityType).toBeNull();
      expect(result.authorEntityId).toBeNull();
    });
  });

  describe("note.get", () => {
    it("returns a note by id", async () => {
      const noteId = await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.note.get({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.id).toBe(noteId);
    });
  });

  describe("note.list", () => {
    it("returns notes of the caller's system", async () => {
      await seedNote(ctx.db, primary.systemId, primary.auth);
      await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // listNotes returns PaginatedResult<NoteResult> ⇒ `data`, not `items`.
      const result = await caller.note.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("note.update", () => {
    it("updates a note's encrypted data", async () => {
      const noteId = await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      // UpdateNoteBodySchema requires `version` (optimistic concurrency token).
      // Newly seeded notes start at version 1.
      const result = await caller.note.update({
        systemId: primary.systemId,
        noteId,
        encryptedData: testEncryptedDataBase64(),
        version: INITIAL_NOTE_VERSION,
      });
      expect(result.id).toBe(noteId);
    });
  });

  describe("note.archive", () => {
    it("archives a note", async () => {
      const noteId = await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.note.archive({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("note.restore", () => {
    it("restores an archived note", async () => {
      const noteId = await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      await caller.note.archive({
        systemId: primary.systemId,
        noteId,
      });
      const restored = await caller.note.restore({
        systemId: primary.systemId,
        noteId,
      });
      expect(restored.id).toBe(noteId);
    });
  });

  describe("note.delete", () => {
    it("deletes a note", async () => {
      const noteId = await seedNote(ctx.db, primary.systemId, primary.auth);
      const caller = makeCaller(primary.auth);
      const result = await caller.note.delete({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Auth-failure: one test for the whole router ────────────────────

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const caller = makeCaller(null);
      await expectAuthRequired(caller.note.list({ systemId: primary.systemId }));
    });
  });

  // ── Tenant isolation: one test for the whole router ────────────────

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's note", async () => {
      const otherNoteId = await seedNote(ctx.db, other.systemId, other.auth);
      const caller = makeCaller(primary.auth);
      await expectTenantDenied(
        caller.note.get({
          systemId: other.systemId,
          noteId: otherNoteId,
        }),
      );
    });
  });
});
