/**
 * Contract test suite for ConflictPersistenceAdapter implementations.
 *
 * Usage:
 *   import { runConflictPersistenceContract } from "./conflict-persistence.contract.js";
 *   runConflictPersistenceContract(() => new YourAdapter());
 *
 * The factory function is called before each test to produce a fresh,
 * empty adapter instance. Tests verify the two required methods:
 *   - saveConflicts() — round-trip persistence
 *   - deleteOlderThan() — time-based pruning
 */
import { describe, expect, it } from "vitest";

import type { ConflictPersistenceAdapter } from "../conflict-persistence.js";
import type { ConflictNotification } from "../types.js";

// ── Helpers ───────────────────────────────────────────────────────────

function makeNotification(overrides: Partial<ConflictNotification> = {}): ConflictNotification {
  return {
    entityType: "member",
    entityId: `entity_${crypto.randomUUID()}`,
    fieldName: "displayName",
    resolution: "lww-field",
    detectedAt: Date.now(),
    summary: "Concurrent edit on displayName resolved by last-writer-wins",
    ...overrides,
  };
}

// ── Contract ──────────────────────────────────────────────────────────

export function runConflictPersistenceContract(factory: () => ConflictPersistenceAdapter): void {
  describe("ConflictPersistenceAdapter contract", () => {
    describe("saveConflicts", () => {
      it("completes without error for a single notification", async () => {
        const adapter = factory();
        const notification = makeNotification();
        await expect(adapter.saveConflicts("doc-1", [notification])).resolves.toBeUndefined();
      });

      it("completes without error for multiple notifications", async () => {
        const adapter = factory();
        const notifications = [
          makeNotification({ resolution: "lww-field" }),
          makeNotification({ resolution: "append-both", fieldName: "notes" }),
          makeNotification({ resolution: "add-wins", fieldName: null }),
        ];
        await expect(adapter.saveConflicts("doc-multi", notifications)).resolves.toBeUndefined();
      });

      it("handles empty notification array", async () => {
        const adapter = factory();
        await expect(adapter.saveConflicts("doc-empty", [])).resolves.toBeUndefined();
      });

      it("is idempotent — calling twice with the same data does not error", async () => {
        const adapter = factory();
        const notification = makeNotification();
        await adapter.saveConflicts("doc-idem", [notification]);
        await expect(adapter.saveConflicts("doc-idem", [notification])).resolves.toBeUndefined();
      });
    });

    describe("deleteOlderThan", () => {
      it("returns 0 when no records exist", async () => {
        const adapter = factory();
        const count = await adapter.deleteOlderThan(Date.now());
        expect(count).toBe(0);
      });

      it("prunes records older than the cutoff", async () => {
        const adapter = factory();
        const oldTimestamp = 1_000;
        const recentTimestamp = Date.now();

        await adapter.saveConflicts("doc-prune", [makeNotification({ detectedAt: oldTimestamp })]);
        await adapter.saveConflicts("doc-prune", [
          makeNotification({ detectedAt: recentTimestamp }),
        ]);

        // Delete records older than a cutoff between old and recent
        const cutoff = Math.floor((oldTimestamp + recentTimestamp) / 2);
        const deleted = await adapter.deleteOlderThan(cutoff);
        expect(deleted).toBeGreaterThanOrEqual(1);
      });

      it("keeps records at exactly the cutoff timestamp (strict less-than semantics)", async () => {
        const adapter = factory();
        const exactTimestamp = 50_000;

        await adapter.saveConflicts("doc-boundary", [
          makeNotification({ detectedAt: exactTimestamp }),
        ]);

        // cutoff === detectedAt — record is NOT "older than" cutoff, so should survive
        const deleted = await adapter.deleteOlderThan(exactTimestamp);
        expect(deleted).toBe(0);
      });

      it("returns 0 when all records are newer than the cutoff", async () => {
        const adapter = factory();
        const now = Date.now();

        await adapter.saveConflicts("doc-fresh", [makeNotification({ detectedAt: now })]);

        // Cutoff is in the past — nothing should be deleted
        const deleted = await adapter.deleteOlderThan(now - 100_000);
        expect(deleted).toBe(0);
      });
    });
  });
}

// ── In-memory reference implementation ────────────────────────────────

interface StoredConflict {
  readonly documentId: string;
  readonly notification: ConflictNotification;
}

/**
 * In-memory ConflictPersistenceAdapter for use in contract tests.
 * Not suitable for production — data is lost on process exit.
 */
export class InMemoryConflictPersistenceAdapter implements ConflictPersistenceAdapter {
  private readonly records: StoredConflict[] = [];

  saveConflicts(documentId: string, notifications: readonly ConflictNotification[]): Promise<void> {
    for (const notification of notifications) {
      this.records.push({ documentId, notification });
    }
    return Promise.resolve();
  }

  deleteOlderThan(cutoffMs: number): Promise<number> {
    const before = this.records.length;
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < this.records.length; readIdx++) {
      const record = this.records[readIdx];
      if (record && record.notification.detectedAt >= cutoffMs) {
        this.records[writeIdx] = record;
        writeIdx++;
      }
    }
    this.records.length = writeIdx;
    return Promise.resolve(before - writeIdx);
  }
}
