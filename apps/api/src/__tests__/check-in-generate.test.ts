import { toUnixMillis, brandId } from "@pluralscape/types";
import { parseTimeToMinutes } from "@pluralscape/validation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { computeIdempotencyKey, createCheckInGenerateHandler } from "../jobs/check-in-generate.js";

import { mockDb } from "./helpers/mock-db.js";

import type { JobHandlerContext } from "@pluralscape/queue";
import type { JobDefinition, JobId } from "@pluralscape/types";

const { loggerWarnMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));
vi.mock("../lib/logger.js", () => ({
  logger: { warn: loggerWarnMock, info: vi.fn(), error: loggerErrorMock },
}));

describe("parseTimeToMinutes", () => {
  it("parses valid HH:MM string", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("12:00")).toBe(720);
  });

  it("returns null for invalid formats", () => {
    expect(parseTimeToMinutes("8:30")).toBeNull();
    expect(parseTimeToMinutes("invalid")).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });

  it("returns null for out-of-range hours", () => {
    expect(parseTimeToMinutes("25:00")).toBeNull();
  });
});

describe("computeIdempotencyKey", () => {
  it("produces consistent keys within the same interval window", () => {
    const configId = "tmr_test-config";
    const intervalMinutes = 30;

    // Two timestamps 10 minutes apart within the same 30-min window
    const t1 = 1_800_000; // 30 min * 60s * 1000ms = window 1
    const t2 = 1_800_000 + 600_000; // +10 min, still window 1

    const key1 = computeIdempotencyKey(configId, intervalMinutes, t1);
    const key2 = computeIdempotencyKey(configId, intervalMinutes, t2);

    expect(key1).toBe(key2);
  });

  it("produces different keys in different interval windows", () => {
    const configId = "tmr_test-config";
    const intervalMinutes = 30;

    // Window boundary: 30 min * 60s * 1000ms = 1_800_000
    const t1 = 1_800_000;
    const t2 = 1_800_000 * 2; // Next window

    const key1 = computeIdempotencyKey(configId, intervalMinutes, t1);
    const key2 = computeIdempotencyKey(configId, intervalMinutes, t2);

    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different timer configs", () => {
    const t = 1_800_000;
    const key1 = computeIdempotencyKey("tmr_a", 30, t);
    const key2 = computeIdempotencyKey("tmr_b", 30, t);

    expect(key1).not.toBe(key2);
  });
});

// ---------------------------------------------------------------------------
// Handler-level tests
// ---------------------------------------------------------------------------

function stubJob(): JobDefinition<"check-in-generate"> {
  return {
    id: brandId<JobId>("job_test"),
    systemId: null,
    type: "check-in-generate" as const,
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
  } satisfies JobDefinition<"check-in-generate">;
}

const heartbeatFn = vi.fn().mockResolvedValue(undefined);

function stubCtx(): JobHandlerContext & { heartbeatFn: ReturnType<typeof vi.fn> } {
  heartbeatFn.mockClear();
  return {
    heartbeat: { heartbeat: heartbeatFn },
    signal: new AbortController().signal,
    heartbeatFn,
  };
}

function makeConfig(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "tmr_test-1",
    systemId: "sys_test-1",
    enabled: true,
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    encryptedData: Buffer.from("test"),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe("createCheckInGenerateHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    loggerWarnMock.mockClear();
    loggerErrorMock.mockClear();
  });

  it("skips processing when signal is already aborted", async () => {
    const { db, chain } = mockDb();
    const handler = createCheckInGenerateHandler(db);

    const ac = new AbortController();
    ac.abort();

    await handler(stubJob(), {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: ac.signal,
    });

    expect(chain.select).not.toHaveBeenCalled();
  });

  it("returns early on empty config list", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([]);
    const handler = createCheckInGenerateHandler(db);

    await handler(stubJob(), stubCtx());

    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("skips config with null intervalMinutes", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([makeConfig({ intervalMinutes: null })]);
    const handler = createCheckInGenerateHandler(db);

    await handler(stubJob(), stubCtx());

    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("creates check-in record with idempotency key", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T08:00:00Z"));

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([makeConfig()]);
    // onConflictDoNothing resolves to indicate one row was inserted
    chain.onConflictDoNothing.mockResolvedValue([{ id: "cir_test-1" }]);
    const handler = createCheckInGenerateHandler(db);

    await handler(stubJob(), stubCtx());

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(chain.values).toHaveBeenCalledOnce();

    const firstCall = chain.values.mock.calls[0];
    expect(firstCall).toBeDefined();
    const valuesArg = (firstCall as [Record<string, unknown>])[0];
    expect(valuesArg).toHaveProperty("idempotencyKey");
    expect(typeof valuesArg.idempotencyKey).toBe("string");
    expect(valuesArg.timerConfigId).toBe("tmr_test-1");

    expect(chain.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("handles idempotency conflict gracefully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([makeConfig()]);
    // onConflictDoNothing returns chain, then resolves to [] (no row created = conflict)
    chain.onConflictDoNothing.mockResolvedValue([]);
    const handler = createCheckInGenerateHandler(db);

    await expect(handler(stubJob(), stubCtx())).resolves.toBeUndefined();
    expect(chain.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("isolates per-config errors and continues processing remaining configs", async () => {
    const { db, chain } = mockDb();

    const config1 = makeConfig({ id: "tmr_test-1" });
    const config2 = makeConfig({ id: "tmr_test-2" });
    chain.limit.mockResolvedValue([config1, config2]);

    // First call to values throws; second succeeds
    chain.values
      .mockImplementationOnce(() => {
        throw new Error("DB error");
      })
      .mockReturnValue(chain);

    const handler = createCheckInGenerateHandler(db);

    // Handler still processes all configs, then throws at the end
    await expect(handler(stubJob(), stubCtx())).rejects.toThrow("errored during processing");

    expect(loggerWarnMock).toHaveBeenCalledOnce();
    expect(chain.insert).toHaveBeenCalledTimes(2);
  });

  it("calls heartbeat on each iteration", async () => {
    const { db, chain } = mockDb();

    const config1 = makeConfig({ id: "tmr_test-1" });
    const config2 = makeConfig({ id: "tmr_test-2" });
    chain.limit.mockResolvedValue([config1, config2]);
    chain.onConflictDoNothing.mockResolvedValue([]);

    const ctx = stubCtx();
    const handler = createCheckInGenerateHandler(db);

    await handler(stubJob(), ctx);

    expect(ctx.heartbeatFn).toHaveBeenCalledTimes(2);
  });

  it("stops processing when signal is aborted mid-loop", async () => {
    const { db, chain } = mockDb();

    const config1 = makeConfig({ id: "tmr_test-1" });
    const config2 = makeConfig({ id: "tmr_test-2" });
    chain.limit.mockResolvedValue([config1, config2]);

    const ac = new AbortController();
    const ctx = {
      heartbeat: {
        heartbeat: vi.fn().mockImplementation(() => {
          // Abort after first heartbeat (first config processed)
          ac.abort();
          return Promise.resolve();
        }),
      },
      signal: ac.signal,
    };

    const handler = createCheckInGenerateHandler(db);
    await handler(stubJob(), ctx);

    // Only first config should have been processed — heartbeat fires,
    // then abort check at top of next iteration stops processing
    expect(ctx.heartbeat.heartbeat).toHaveBeenCalledOnce();
  });

  it("throws when configs fail during processing", async () => {
    const { db, chain } = mockDb();

    chain.limit.mockResolvedValue([makeConfig({ id: "tmr_test-1" })]);
    chain.values.mockImplementationOnce(() => {
      throw new Error("DB error");
    });

    const handler = createCheckInGenerateHandler(db);

    await expect(handler(stubJob(), stubCtx())).rejects.toThrow("errored during processing");
  });

  it("paginates across multiple full batches (cursor !== null branch)", async () => {
    const { CHECK_IN_GENERATE_BATCH_SIZE } = await import("../jobs/jobs.constants.js");
    const { db, chain } = mockDb();

    const fullBatch = Array.from({ length: CHECK_IN_GENERATE_BATCH_SIZE }, (_, i) =>
      makeConfig({ id: `tmr_test-batch1-${String(i)}` }),
    );
    const partialBatch = [makeConfig({ id: "tmr_test-batch2-0" })];

    // First call returns a full batch (forces second iteration where cursor !== null);
    // second call returns a partial batch (terminates the loop).
    chain.limit.mockResolvedValueOnce(fullBatch).mockResolvedValueOnce(partialBatch);

    const handler = createCheckInGenerateHandler(db);
    await handler(stubJob(), stubCtx());

    // Two select cycles → CHECK_IN_GENERATE_BATCH_SIZE + 1 inserts
    expect(chain.insert).toHaveBeenCalledTimes(CHECK_IN_GENERATE_BATCH_SIZE + 1);
    // limit was called twice (once for each batch fetch)
    expect(chain.limit).toHaveBeenCalledTimes(2);
  });
});
