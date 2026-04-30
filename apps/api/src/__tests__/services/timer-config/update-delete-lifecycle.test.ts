import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../../helpers/mock-crypto.js";
import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, SYSTEM_ID, TIMER_ID, makeTimerRow } from "./internal.js";

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

const { updateTimerConfig } = await import("../../../services/timer-config/update.js");
const { deleteTimerConfig } = await import("../../../services/timer-config/delete.js");
const { archiveTimerConfig, restoreTimerConfig } =
  await import("../../../services/timer-config/lifecycle.js");
const { parseTimerConfigQuery } = await import("../../../services/timer-config/queries.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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

  it("recomputes nextCheckInAt when scheduling fields change", async () => {
    const { db, chain } = mockDb();
    // First select (current row lookup) returns a row with enabled + interval
    chain.limit.mockResolvedValueOnce([makeTimerRow({ enabled: true, intervalMinutes: 30 })]);
    // update().set().where().returning() returns the updated row
    chain.returning.mockResolvedValueOnce([makeTimerRow({ version: 2, intervalMinutes: 60 })]);

    const result = await updateTimerConfig(
      db,
      SYSTEM_ID,
      TIMER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1, intervalMinutes: 60 },
      AUTH,
      mockAudit,
    );

    expect(result.intervalMinutes).toBe(60);
    expect(result.version).toBe(2);
  });

  it("clears nextCheckInAt when disabling timer in update", async () => {
    const { db, chain } = mockDb();
    // Current row has enabled=true, interval set
    chain.limit.mockResolvedValueOnce([makeTimerRow({ enabled: true, intervalMinutes: 30 })]);
    // update returns updated row with enabled=false
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

  it("recomputes nextCheckInAt with waking hours in update", async () => {
    const { db, chain } = mockDb();
    // Current row has enabled=true, interval set, and waking hours
    chain.limit.mockResolvedValueOnce([
      makeTimerRow({
        enabled: true,
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: "22:00",
      }),
    ]);
    chain.returning.mockResolvedValueOnce([
      makeTimerRow({ version: 2, wakingHoursOnly: true, wakingStart: "09:00", wakingEnd: "21:00" }),
    ]);

    const result = await updateTimerConfig(
      db,
      SYSTEM_ID,
      TIMER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1, wakingStart: "09:00", wakingEnd: "21:00" },
      AUTH,
      mockAudit,
    );

    expect(result.wakingStart).toBe("09:00");
    expect(result.wakingEnd).toBe("21:00");
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
      deleteTimerConfig(db, SYSTEM_ID, brandId<TimerId>("tmr_nonexistent"), AUTH, mockAudit),
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
      archiveTimerConfig(db, SYSTEM_ID, brandId<TimerId>("tmr_nonexistent"), AUTH, mockAudit),
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
    chain.returning.mockResolvedValueOnce([]);
    chain.where
      .mockReturnValueOnce(chain) // update chain → .returning()
      .mockResolvedValueOnce([]); // select existence check finds nothing

    await expect(
      restoreTimerConfig(db, SYSTEM_ID, brandId<TimerId>("tmr_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when entity is not archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
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

    expect(typeof result).toBe("object");
  });

  it("throws 400 for invalid query parameters", () => {
    expect(() => parseTimerConfigQuery({ includeArchived: "not-a-boolean" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
