import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../helpers/mock-crypto.js";
import { captureWhereArg, mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { MockChain } from "../helpers/mock-db.js";
import type { SystemId, TimerId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const {
  createTimerConfig,
  listTimerConfigs,
  getTimerConfig,
  updateTimerConfig,
  deleteTimerConfig,
  archiveTimerConfig,
  restoreTimerConfig,
  parseTimerConfigQuery,
} = await import("../../services/timer-config.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_timer-test-system" as SystemId;
const TIMER_ID = "tmr_timer-test-config" as TimerId;

const AUTH: AuthContext = {
  accountId: "acct_timer-test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_timer-test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeTimerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TIMER_ID,
    systemId: SYSTEM_ID,
    enabled: true,
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

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

  it("throws 400 for invalid body (missing encryptedData)", async () => {
    const { db } = mockDb();

    await expect(
      createTimerConfig(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
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

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createTimerConfig(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow("Failed to create timer config");
  });

  it("throws 400 when wakingHoursOnly is true but wakingStart/wakingEnd missing", async () => {
    const { db } = mockDb();

    await expect(
      createTimerConfig(
        db,
        SYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          wakingHoursOnly: true,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
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

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns timer configs for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeTimerRow()]);

    const result = await listTimerConfigs(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(TIMER_ID);
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
    expect(result.items).toHaveLength(25);
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

    await expect(getTimerConfig(db, SYSTEM_ID, "tmr_nonexistent" as TimerId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
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
      makeTimerRow({
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: "22:00",
      }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    expect(result.wakingHoursOnly).toBe(true);
    expect(result.wakingStart).toBe("08:00");
    expect(result.wakingEnd).toBe("22:00");
  });

  it("maps wakingHoursOnly null branch correctly", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({
        wakingHoursOnly: null,
        wakingStart: null,
        wakingEnd: null,
      }),
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
      makeTimerRow({
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: "22:00",
      }),
    ]);

    const result = await getTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH);

    // Falls through to else: wakingHoursOnly true becomes false in the else branch
    expect(result.wakingHoursOnly).toBe(false);
  });

  it("maps wakingHoursOnly true with null wakingEnd to false branch", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: null,
      }),
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

describe("updateTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates timer config with version increment", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTimerRow({ version: 2 })]);

    const result = await updateTimerConfig(
      db,
      SYSTEM_ID,
      TIMER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "timer-config.updated" }),
    );
  });

  it("updates with all optional fields", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([
      makeTimerRow({
        version: 2,
        enabled: false,
        intervalMinutes: 120,
        wakingHoursOnly: true,
        wakingStart: "09:00",
        wakingEnd: "21:00",
      }),
    ]);

    const result = await updateTimerConfig(
      db,
      SYSTEM_ID,
      TIMER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        version: 1,
        enabled: false,
        intervalMinutes: 120,
        wakingHoursOnly: true,
        wakingStart: "09:00",
        wakingEnd: "21:00",
      },
      AUTH,
      mockAudit,
    );

    expect(result.enabled).toBe(false);
    expect(result.intervalMinutes).toBe(120);
    expect(result.wakingHoursOnly).toBe(true);
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);

    await expect(
      updateTimerConfig(
        db,
        SYSTEM_ID,
        TIMER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when timer config not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateTimerConfig(
        db,
        SYSTEM_ID,
        TIMER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      updateTimerConfig(
        db,
        SYSTEM_ID,
        TIMER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (missing encryptedData)", async () => {
    const { db } = mockDb();

    await expect(
      updateTimerConfig(db, SYSTEM_ID, TIMER_ID, { version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for missing version", async () => {
    const { db } = mockDb();

    await expect(
      updateTimerConfig(
        db,
        SYSTEM_ID,
        TIMER_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("applies partial updates with only enabled field", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTimerRow({ version: 2, enabled: false })]);

    const result = await updateTimerConfig(
      db,
      SYSTEM_ID,
      TIMER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1, enabled: false },
      AUTH,
      mockAudit,
    );

    expect(result.enabled).toBe(false);
  });
});

describe("deleteTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes timer config with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence check -> .limit()
      .mockResolvedValueOnce([{ count: 0 }]); // check-in record count

    await deleteTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "timer-config.deleted" }),
    );
  });

  it("throws 404 when timer config not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteTimerConfig(db, SYSTEM_ID, "tmr_nonexistent" as TimerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when has dependent check-in records", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence check -> .limit()
      .mockResolvedValueOnce([{ count: 3 }]); // check-in record count

    await expect(deleteTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("3 non-archived check-in record(s)"),
      }),
    );
  });

  it("throws when count query returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence check -> .limit()
      .mockResolvedValueOnce([]); // count query returns nothing

    await expect(deleteTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      "Unexpected: count query returned no rows",
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(deleteTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("archiveTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives a timer config", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: TIMER_ID }]);

    await archiveTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "timer-config.archived" }),
    );
  });

  it("throws 404 when timer config not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveTimerConfig(db, SYSTEM_ID, "tmr_nonexistent" as TimerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when already archived", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain so .returning() is callable
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() resolves directly
    chain.where
      .mockReturnValueOnce(chain) // update chain → .returning()
      .mockResolvedValueOnce([{ id: TIMER_ID }]); // select existence check

    await expect(archiveTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(archiveTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("restoreTimerConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores an archived timer config", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeTimerRow({ version: 2, archived: false })]);

    const result = await restoreTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "timer-config.restored" }),
    );
  });

  it("throws 404 when archived timer config not found", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain so .returning() is callable
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() resolves directly
    chain.where
      .mockReturnValueOnce(chain) // update chain → .returning()
      .mockResolvedValueOnce([]); // select existence check finds nothing

    await expect(
      restoreTimerConfig(db, SYSTEM_ID, "tmr_nonexistent" as TimerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when entity is not archived", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain so .returning() is callable
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() resolves to found row
    chain.where
      .mockReturnValueOnce(chain) // update chain → .returning()
      .mockResolvedValueOnce([{ id: TIMER_ID }]); // select finds the non-archived row

    await expect(restoreTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(restoreTimerConfig(db, SYSTEM_ID, TIMER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("parseTimerConfigQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid query with includeArchived true", () => {
    const result = parseTimerConfigQuery({ includeArchived: "true" });

    expect(result).toEqual({ includeArchived: true });
  });

  it("parses valid query with includeArchived false", () => {
    const result = parseTimerConfigQuery({ includeArchived: "false" });

    expect(result).toEqual({ includeArchived: false });
  });

  it("parses empty query params", () => {
    const result = parseTimerConfigQuery({});

    expect(result).toBeDefined();
  });

  it("throws 400 for invalid query parameters", () => {
    expect(() => parseTimerConfigQuery({ includeArchived: "not-a-boolean" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
