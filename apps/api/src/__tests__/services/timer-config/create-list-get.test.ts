import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../../helpers/mock-crypto.js";
import { captureWhereArg, mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, SYSTEM_ID, TIMER_ID, makeTimerRow } from "./internal.js";

import type { MockChain } from "../../helpers/mock-db.js";
import type { TimerId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const { createTimerConfig } = await import("../../../services/timer-config/create.js");
const { listTimerConfigs, getTimerConfig } =
  await import("../../../services/timer-config/queries.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("createTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a timer config with defaults", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTimerRow()]);

    const result = await createTimerConfig(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(TIMER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.enabled).toBe(true);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "timer-config.created" }),
    );
  });

  it("creates a timer config with all optional fields", async () => {
    const row = makeTimerRow({
      enabled: false,
      intervalMinutes: 60,
      wakingHoursOnly: true,
      wakingStart: "08:00",
      wakingEnd: "22:00",
    });
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createTimerConfig(
      db,
      SYSTEM_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        enabled: false,
        intervalMinutes: 60,
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: "22:00",
      },
      AUTH,
      mockAudit,
    );

    expect(result.enabled).toBe(false);
    expect(result.intervalMinutes).toBe(60);
    expect(result.wakingHoursOnly).toBe(true);
    expect(result.wakingStart).toBe("08:00");
    expect(result.wakingEnd).toBe("22:00");
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createTimerConfig(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for oversized encryptedData", async () => {
    const { db } = mockDb();
    const oversized = Buffer.from(new Uint8Array(70_000)).toString("base64");

    await expect(
      createTimerConfig(db, SYSTEM_ID, { encryptedData: oversized }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400 }));
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createTimerConfig(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("computes nextCheckInAt when enabled with intervalMinutes", async () => {
    const row = makeTimerRow({ intervalMinutes: 15 });
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createTimerConfig(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, intervalMinutes: 15 },
      AUTH,
      mockAudit,
    );

    expect(result.intervalMinutes).toBe(15);
    expect(result.enabled).toBe(true);
    // values() receives the insert payload including a computed nextCheckInAt
    const insertPayload = chain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertPayload.nextCheckInAt).toBeTypeOf("number");
  });

  it("computes nextCheckInAt with waking hours in create", async () => {
    const row = makeTimerRow({
      intervalMinutes: 30,
      wakingHoursOnly: true,
      wakingStart: "08:00",
      wakingEnd: "22:00",
    });
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createTimerConfig(
      db,
      SYSTEM_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: "22:00",
      },
      AUTH,
      mockAudit,
    );

    expect(result.intervalMinutes).toBe(30);
    const insertPayload = chain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertPayload.nextCheckInAt).toBeTypeOf("number");
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createTimerConfig(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow("Failed to create timer config");
  });
});

describe("listTimerConfigs", () => {
  async function callListWithFilter(opts = {}): Promise<MockChain> {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listTimerConfigs(db, SYSTEM_ID, AUTH, opts);
    return chain;
  }

  let baseWhereArg: unknown;
  beforeAll(async () => {
    const chain = await callListWithFilter();
    baseWhereArg = captureWhereArg(chain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no timer configs exist", async () => {
    const { db } = mockDb();

    const result = await listTimerConfigs(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns timer configs for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTimerRow()]);

    const result = await listTimerConfigs(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(TIMER_ID);
  });

  it("caps limit to MAX_PAGE_LIMIT (100)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listTimerConfigs(db, SYSTEM_ID, AUTH, { limit: 999 });

    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses default limit when not specified", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listTimerConfigs(db, SYSTEM_ID, AUTH, {});

    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("applies cursor when provided", async () => {
    const chain = await callListWithFilter({ cursor: "tmr_some-cursor" });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("filters out archived by default", async () => {
    const chain = await callListWithFilter({});

    expect(chain.where).toHaveBeenCalledTimes(1);
  });

  it("includes archived when includeArchived is true", async () => {
    const chain = await callListWithFilter({ includeArchived: true });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("returns hasMore true when more results exist", async () => {
    const { db, chain } = mockDb();
    // Default limit is 25, so returning 26 items triggers hasMore
    const rows = Array.from({ length: 26 }, (_, i) =>
      makeTimerRow({ id: `tmr_item-${String(i).padStart(3, "0")}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listTimerConfigs(db, SYSTEM_ID, AUTH, {});

    expect(result.hasMore).toBe(true);
    expect(result.data).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(listTimerConfigs(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("getTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns timer config for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTimerRow()]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.id).toBe(TIMER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getTimerConfig(db, SYSTEM_ID, brandId<TimerId>("tmr_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("maps wakingHoursOnly true branch correctly", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({ wakingHoursOnly: true, wakingStart: "08:00", wakingEnd: "22:00" }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.wakingHoursOnly).toBe(true);
    expect(result.wakingStart).toBe("08:00");
    expect(result.wakingEnd).toBe("22:00");
  });

  it("maps wakingHoursOnly null branch correctly", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({ wakingHoursOnly: null, wakingStart: null, wakingEnd: null }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.wakingHoursOnly).toBeNull();
    expect(result.wakingStart).toBeNull();
    expect(result.wakingEnd).toBeNull();
  });

  it("maps wakingHoursOnly true with null wakingStart to false branch", async () => {
    const { db, chain } = mockDb();
    // wakingHoursOnly=true but wakingStart=null falls to else branch
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({ wakingHoursOnly: true, wakingStart: null, wakingEnd: "22:00" }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    // Falls through to else: wakingHoursOnly true becomes false in the else branch
    expect(result.wakingHoursOnly).toBe(false);
  });

  it("maps wakingHoursOnly true with null wakingEnd to false branch", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({ wakingHoursOnly: true, wakingStart: "08:00", wakingEnd: null }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.wakingHoursOnly).toBe(false);
  });

  it("maps archivedAt to UnixMillis when present", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTimerRow({ archivedAt: 5000 })]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.archivedAt).toBe(5000);
  });

  it("maps archivedAt to null when absent", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTimerRow()]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.archivedAt).toBeNull();
  });
});
