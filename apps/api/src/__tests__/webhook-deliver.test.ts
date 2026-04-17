import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { JobDefinition, JobId, WebhookDeliveryId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Mocks ───────────────────────────────────────────────────────────

const mockProcessWebhookDelivery = vi.fn().mockResolvedValue(undefined);

vi.mock("../services/webhook-delivery-worker.js", () => ({
  processWebhookDelivery: mockProcessWebhookDelivery,
}));

const { createWebhookDeliverHandler } = await import("../jobs/webhook-deliver.js");

// ── Helpers ─────────────────────────────────────────────────────────

function stubJob(
  overrides?: Partial<JobDefinition<"webhook-deliver">>,
): JobDefinition<"webhook-deliver"> {
  return {
    id: brandId<JobId>("job_test"),
    systemId: null,
    type: "webhook-deliver" as const,
    status: "running",
    payload: {
      deliveryId: brandId<WebhookDeliveryId>("whdel_test123"),
    },
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
    ...overrides,
  } satisfies JobDefinition<"webhook-deliver">;
}

function stubCtx(): JobHandlerContext {
  return {
    heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
    signal: new AbortController().signal,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("webhook-deliver handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls processWebhookDelivery with the delivery ID and payload", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliverHandler(db);
    const job = stubJob();

    await handler(job, stubCtx());

    expect(mockProcessWebhookDelivery).toHaveBeenCalledWith(db, "whdel_test123");
  });

  it("skips processing when signal is already aborted", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliverHandler(db);
    const abortController = new AbortController();
    abortController.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: abortController.signal,
    });

    expect(mockProcessWebhookDelivery).not.toHaveBeenCalled();
  });

  it("propagates errors from processWebhookDelivery", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createWebhookDeliverHandler(db);
    mockProcessWebhookDelivery.mockRejectedValueOnce(new Error("delivery failed"));

    await expect(handler(stubJob(), stubCtx())).rejects.toThrow("delivery failed");
  });
});
