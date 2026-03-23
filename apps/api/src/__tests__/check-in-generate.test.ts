import { toUnixMillis } from "@pluralscape/types";
import { parseTimeToMinutes } from "@pluralscape/validation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCheckInGenerateHandler } from "../jobs/check-in-generate.js";
import {
  computeIdempotencyKey,
  getCurrentMinutesUtc,
  isWithinWakingHours,
} from "../jobs/check-in-generate.js";

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

describe("isWithinWakingHours", () => {
  it("returns true when within window", () => {
    // 10:00 is within 08:00-22:00
    expect(isWithinWakingHours(600, 480, 1320)).toBe(true);
  });

  it("returns false when before window", () => {
    // 06:00 is before 08:00-22:00
    expect(isWithinWakingHours(360, 480, 1320)).toBe(false);
  });

  it("returns false when after window", () => {
    // 23:00 is after 08:00-22:00
    expect(isWithinWakingHours(1380, 480, 1320)).toBe(false);
  });

  it("returns true at exact start", () => {
    expect(isWithinWakingHours(480, 480, 1320)).toBe(true);
  });

  it("returns false at exact end", () => {
    expect(isWithinWakingHours(1320, 480, 1320)).toBe(false);
  });
});

describe("getCurrentMinutesUtc", () => {
  it("returns minutes since midnight for a given timestamp", () => {
    // 2024-01-01T10:30:00Z = 630 minutes
    const timestamp = new Date("2024-01-01T10:30:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(630);
  });

  it("returns 0 for midnight", () => {
    const timestamp = new Date("2024-01-01T00:00:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(0);
  });

  it("returns 1439 for 23:59", () => {
    const timestamp = new Date("2024-01-01T23:59:00Z").getTime();
    expect(getCurrentMinutesUtc(timestamp)).toBe(1439);
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
    id: "job_test" as JobId,
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

  it("skips config outside waking hours", async () => {
    vi.useFakeTimers();
    // Set system time to 08:00 UTC — outside the 22:00–23:00 waking window
    vi.setSystemTime(new Date("2024-01-01T08:00:00Z"));

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([
      makeConfig({
        wakingHoursOnly: true,
        wakingStart: "22:00",
        wakingEnd: "23:00",
      }),
    ]);
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

  it("isolates per-config errors and continues", async () => {
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

    await handler(stubJob(), stubCtx());

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

  it("warns on unparseable waking time and skips config", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T10:00:00Z"));

    const { db, chain } = mockDb();
    chain.limit.mockResolvedValue([
      makeConfig({
        wakingHoursOnly: true,
        wakingStart: "8:30", // invalid — single digit hour
        wakingEnd: "22:00",
      }),
    ]);
    const handler = createCheckInGenerateHandler(db);

    await handler(stubJob(), stubCtx());

    expect(chain.insert).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledOnce();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "Timer config has unparseable waking time, skipping",
      expect.objectContaining({ timerConfigId: "tmr_test-1" }),
    );
  });

  it("logs error summary when configs fail", async () => {
    const { db, chain } = mockDb();

    chain.limit.mockResolvedValue([makeConfig({ id: "tmr_test-1" })]);
    chain.values.mockImplementationOnce(() => {
      throw new Error("DB error");
    });

    const handler = createCheckInGenerateHandler(db);
    await handler(stubJob(), stubCtx());

    expect(loggerErrorMock).toHaveBeenCalledOnce();
    expect(loggerErrorMock).toHaveBeenCalledWith("Check-in generation completed with errors", {
      errorCount: 1,
    });
  });
});
