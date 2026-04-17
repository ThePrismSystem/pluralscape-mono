import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "../../lib/audit-log.js";

import type { WriteAuditLogParams } from "../../lib/audit-log.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("al_mock-uuid"),
    now: vi.fn().mockReturnValue(1_700_000_000_000),
  };
});

/** Cast a test mock to PostgresJsDatabase. */
function asDb(mock: unknown): PostgresJsDatabase {
  return mock as PostgresJsDatabase;
}

function createMockDb(): { db: PostgresJsDatabase; valuesSpy: ReturnType<typeof vi.fn> } {
  const valuesSpy = vi.fn().mockResolvedValue(undefined);
  const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });
  return { db: asDb({ insert: insertSpy }), valuesSpy };
}

function baseParams(overrides?: Partial<WriteAuditLogParams>): WriteAuditLogParams {
  return {
    accountId: brandId<AccountId>("acc_test-account"),
    systemId: brandId<SystemId>("sys_test-system"),
    eventType: "auth.login",
    actor: { kind: "account", id: "acc_test-account" },
    ...overrides,
  };
}

describe("writeAuditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts with the correct eventType", async () => {
    const { db, valuesSpy } = createMockDb();
    await writeAuditLog(db, baseParams({ eventType: "auth.logout" }));

    expect(valuesSpy).toHaveBeenCalledOnce();
    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.eventType).toBe("auth.logout");
  });

  it("includes accountId and systemId", async () => {
    const { db, valuesSpy } = createMockDb();
    await writeAuditLog(
      db,
      baseParams({
        accountId: brandId<AccountId>("acc_abc"),
        systemId: brandId<SystemId>("sys_xyz"),
      }),
    );

    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.accountId).toBe("acc_abc");
    expect(insertedRow.systemId).toBe("sys_xyz");
  });

  it("includes ipAddress and userAgent when provided", async () => {
    const { db, valuesSpy } = createMockDb();
    await writeAuditLog(db, baseParams({ ipAddress: "192.168.1.1", userAgent: "TestBrowser/1.0" }));

    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.ipAddress).toBe("192.168.1.1");
    expect(insertedRow.userAgent).toBe("TestBrowser/1.0");
  });

  it("defaults ipAddress and userAgent to null when omitted", async () => {
    const { db, valuesSpy } = createMockDb();
    await writeAuditLog(db, baseParams());

    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.ipAddress).toBeNull();
    expect(insertedRow.userAgent).toBeNull();
  });

  it("truncates ipAddress longer than 255 characters", async () => {
    const { db, valuesSpy } = createMockDb();
    const longIp = "x".repeat(300);
    await writeAuditLog(db, baseParams({ ipAddress: longIp }));

    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.ipAddress).toHaveLength(255);
  });

  it("truncates userAgent longer than 1024 characters", async () => {
    const { db, valuesSpy } = createMockDb();
    const longUa = "y".repeat(2000);
    await writeAuditLog(db, baseParams({ userAgent: longUa }));

    const insertedRow = valuesSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow.userAgent).toHaveLength(1024);
  });
});
