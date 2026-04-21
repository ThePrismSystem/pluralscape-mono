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

import { createNote } from "../../../services/note/create.js";
import { noteRouter } from "../../../trpc/routers/note.js";
import { noopAudit, testEncryptedDataBase64 } from "../../helpers/integration-setup.js";
import {
  expectAuthRequired,
  expectTenantDenied,
  setupRouterFixture,
} from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { NoteId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const INITIAL_NOTE_VERSION = 1;

/**
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
  const fixture = setupRouterFixture({ note: noteRouter });

  describe("note.create", () => {
    it("creates a note belonging to the caller's system", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(primary.auth);
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
      const primary = fixture.getPrimary();
      const noteId = await seedNote(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.note.get({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.id).toBe(noteId);
    });
  });

  describe("note.list", () => {
    it("returns notes of the caller's system", async () => {
      const primary = fixture.getPrimary();
      const db = fixture.getCtx().db;
      await seedNote(db, primary.systemId, primary.auth);
      await seedNote(db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.note.list({ systemId: primary.systemId });
      expect(result.data.length).toBe(2);
    });
  });

  describe("note.update", () => {
    it("updates a note's encrypted data", async () => {
      const primary = fixture.getPrimary();
      const noteId = await seedNote(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
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
      const primary = fixture.getPrimary();
      const noteId = await seedNote(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.note.archive({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("note.restore", () => {
    it("restores an archived note", async () => {
      const primary = fixture.getPrimary();
      const noteId = await seedNote(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
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
      const primary = fixture.getPrimary();
      const noteId = await seedNote(fixture.getCtx().db, primary.systemId, primary.auth);
      const caller = fixture.getCaller(primary.auth);
      const result = await caller.note.delete({
        systemId: primary.systemId,
        noteId,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("auth", () => {
    it("rejects unauthenticated calls with UNAUTHORIZED", async () => {
      const primary = fixture.getPrimary();
      const caller = fixture.getCaller(null);
      await expectAuthRequired(caller.note.list({ systemId: primary.systemId }));
    });
  });

  describe("tenant isolation", () => {
    it("rejects when primary tries to read other tenant's note", async () => {
      const primary = fixture.getPrimary();
      const other = fixture.getOther();
      const otherNoteId = await seedNote(fixture.getCtx().db, other.systemId, other.auth);
      const caller = fixture.getCaller(primary.auth);
      await expectTenantDenied(
        caller.note.get({
          systemId: other.systemId,
          noteId: otherNoteId,
        }),
      );
    });
  });
});
