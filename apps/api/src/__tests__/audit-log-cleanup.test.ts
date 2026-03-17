import { AUDIT_LOG_RETENTION_DAYS } from "@pluralscape/queue";
import { describe, expect, it, vi } from "vitest";

import { createAuditLogCleanupHandler } from "../jobs/audit-log-cleanup.js";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { JobDefinition, JobId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

vi.mock("@pluralscape/db", () => ({
  pgCleanupAuditLog: vi.fn().mockResolvedValue({ deletedCount: 0 }),
}));

 
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
    createdAt: 0 as UnixMillis,
    startedAt: 0 as UnixMillis,
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

  it("resolves without error when no rows to delete", async () => {
    const db = {} as PostgresJsDatabase;
    const handler = createAuditLogCleanupHandler(db);

    await expect(handler(stubJob(), stubCtx())).resolves.toBeUndefined();
  });
});
