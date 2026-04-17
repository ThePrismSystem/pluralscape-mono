import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { JobDefinition, JobId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Mocks ───────────────────────────────────────────────────────────

const mockCleanupWebhookDeliveries = vi.fn().mockResolvedValue(0);

vi.mock("../services/webhook-delivery-cleanup.js", () => ({
  cleanupWebhookDeliveries: mockCleanupWebhookDeliveries,
}));

const { createWebhookDeliveryCleanupHandler } = await import("../jobs/webhook-delivery-cleanup.js");

// ── Helpers ─────────────────────────────────────────────────────────

function stubJob(): JobDefinition<"webhook-delivery-cleanup"> {
  return {
    id: brandId<JobId>("job_test"),
    systemId: null,
    type: "webhook-delivery-cleanup" as const,
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
  } satisfies JobDefinition<"webhook-delivery-cleanup">;
}

function stubCtx(): JobHandlerContext {
  return {
    heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
    signal: new AbortController().signal,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("webhook-delivery-cleanup handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls cleanupWebhookDeliveries with the db handle", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliveryCleanupHandler(db);

    await handler(stubJob(), stubCtx());

    expect(mockCleanupWebhookDeliveries).toHaveBeenCalledWith(db);
  });

  it("skips cleanup when signal is already aborted", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliveryCleanupHandler(db);
    const abortController = new AbortController();
    abortController.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: abortController.signal,
    });

    expect(mockCleanupWebhookDeliveries).not.toHaveBeenCalled();
  });

  it("resolves without error when no rows to delete", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliveryCleanupHandler(db);

    await expect(handler(stubJob(), stubCtx())).resolves.toBeUndefined();
  });

  it("propagates errors from cleanupWebhookDeliveries", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliveryCleanupHandler(db);
    mockCleanupWebhookDeliveries.mockRejectedValueOnce(new Error("cleanup failed"));

    await expect(handler(stubJob(), stubCtx())).rejects.toThrow("cleanup failed");
  });
});
