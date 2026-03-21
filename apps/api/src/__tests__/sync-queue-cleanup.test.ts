import { toUnixMillis } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { ConflictPersistenceAdapter } from "@pluralscape/sync";
import type { OfflineQueueAdapter } from "@pluralscape/sync/adapters";
import type { JobDefinition, JobId } from "@pluralscape/types";

// ── Mock deps ────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

vi.mock("../jobs/jobs.constants.js", () => ({
  SYNC_QUEUE_RETENTION_MS: 7 * 86_400_000,
  SYNC_CONFLICTS_RETENTION_MS: 90 * 86_400_000,
}));

const { createSyncQueueCleanupHandler } = await import("../jobs/sync-queue-cleanup.js");

// ── Helpers ──────────────────────────────────────────────────────────

function mockOfflineQueueAdapter(): {
  adapter: OfflineQueueAdapter;
  deleteConfirmedFn: ReturnType<typeof vi.fn>;
} {
  const deleteConfirmedFn = vi.fn().mockResolvedValue(0);
  const adapter: OfflineQueueAdapter = {
    enqueue: vi.fn().mockResolvedValue("mock-id"),
    drainUnsynced: vi.fn().mockResolvedValue([]),
    markSynced: vi.fn().mockResolvedValue(undefined),
    deleteConfirmed: deleteConfirmedFn,
  };
  return { adapter, deleteConfirmedFn };
}

function mockConflictPersistenceAdapter(): {
  adapter: ConflictPersistenceAdapter;
  deleteOlderThanFn: ReturnType<typeof vi.fn>;
} {
  const deleteOlderThanFn = vi.fn().mockResolvedValue(0);
  const adapter: ConflictPersistenceAdapter = {
    saveConflicts: vi.fn().mockResolvedValue(undefined),
    deleteOlderThan: deleteOlderThanFn,
  };
  return { adapter, deleteOlderThanFn };
}

function stubJob(): JobDefinition<"sync-queue-cleanup"> {
  return {
    id: "job_test" as JobId,
    systemId: null,
    type: "sync-queue-cleanup" as const,
    status: "running",
    payload: {},
    attempts: 1,
    maxAttempts: 3,
    nextRetryAt: null,
    error: null,
    result: null,
    createdAt: toUnixMillis(0),
    startedAt: toUnixMillis(0),
    completedAt: null,
    idempotencyKey: null,
    lastHeartbeatAt: null,
    timeoutMs: 30_000,
    scheduledFor: null,
    priority: 0,
  } satisfies JobDefinition<"sync-queue-cleanup">;
}

function stubCtx(): JobHandlerContext {
  return {
    heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
    signal: new AbortController().signal,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("sync-queue-cleanup handler", () => {
  it("skips cleanup when signal is already aborted", async () => {
    const { adapter, deleteConfirmedFn } = mockOfflineQueueAdapter();
    const handler = createSyncQueueCleanupHandler(adapter);
    const abortController = new AbortController();
    abortController.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: abortController.signal,
    });

    expect(deleteConfirmedFn).not.toHaveBeenCalled();
  });

  it("calls deleteConfirmed with correct cutoff", async () => {
    const { adapter, deleteConfirmedFn } = mockOfflineQueueAdapter();
    const handler = createSyncQueueCleanupHandler(adapter);
    const ctx = stubCtx();

    const before = Date.now();
    await handler(stubJob(), ctx);
    const after = Date.now();

    expect(deleteConfirmedFn).toHaveBeenCalledTimes(1);
    const cutoff = deleteConfirmedFn.mock.calls[0]?.[0] as number;
    const expectedMin = before - 7 * MS_PER_DAY;
    const expectedMax = after - 7 * MS_PER_DAY;
    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });

  it("cleans conflict records when adapter provided", async () => {
    const { adapter: queueAdapter } = mockOfflineQueueAdapter();
    const { adapter: conflictAdapter, deleteOlderThanFn } = mockConflictPersistenceAdapter();
    const handler = createSyncQueueCleanupHandler(queueAdapter, conflictAdapter);
    const ctx = stubCtx();

    const before = Date.now();
    await handler(stubJob(), ctx);
    const after = Date.now();

    expect(deleteOlderThanFn).toHaveBeenCalledTimes(1);
    const cutoff = deleteOlderThanFn.mock.calls[0]?.[0] as number;
    const expectedMin = before - 90 * MS_PER_DAY;
    const expectedMax = after - 90 * MS_PER_DAY;
    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });

  it("works without conflict adapter (optional param)", async () => {
    const { adapter, deleteConfirmedFn } = mockOfflineQueueAdapter();
    const handler = createSyncQueueCleanupHandler(adapter);
    const ctx = stubCtx();

    await expect(handler(stubJob(), ctx)).resolves.toBeUndefined();
    expect(deleteConfirmedFn).toHaveBeenCalledTimes(1);
  });
});
