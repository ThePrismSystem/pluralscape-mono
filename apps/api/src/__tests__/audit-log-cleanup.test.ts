import { AUDIT_LOG_RETENTION_DAYS } from "@pluralscape/db";
import { toUnixMillis } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuditLogCleanupHandler } from "../jobs/audit-log-cleanup.js";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { JobDefinition, JobId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

vi.mock("@pluralscape/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/db")>();
  return {
    ...actual,
    pgCleanupAuditLog: vi.fn().mockResolvedValue({ deletedCount: 0 }),
  };
});

const { pgCleanupAuditLog } = await import("@pluralscape/db");

/** Minimal job definition for testing. */
function stubJob(): JobDefinition<"audit-log-cleanup"> {
  return {
    id: "job_test" as JobId,
    systemId: null,
    type: "audit-log-cleanup" as const,
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
  } satisfies JobDefinition<"audit-log-cleanup">;
}

function stubCtx(): JobHandlerContext {
  return {
    heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
    signal: new AbortController().signal,
  };
}

describe("audit-log-cleanup handler", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls pgCleanupAuditLog with AUDIT_LOG_RETENTION_DAYS", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createAuditLogCleanupHandler(db);

    await handler(stubJob(), stubCtx());

    expect(pgCleanupAuditLog).toHaveBeenCalledWith(db, {
      olderThanDays: AUDIT_LOG_RETENTION_DAYS,
    });
  });

  it("uses 90-day retention by default", () => {
    expect(AUDIT_LOG_RETENTION_DAYS).toBe(90);
  });

  it("skips cleanup when signal is already aborted", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createAuditLogCleanupHandler(db);
    const abortController = new AbortController();
    abortController.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: abortController.signal,
    });

    expect(pgCleanupAuditLog).not.toHaveBeenCalled();
  });

  it("resolves without error when no rows to delete", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createAuditLogCleanupHandler(db);

    await expect(handler(stubJob(), stubCtx())).resolves.toBeUndefined();
  });
});
