import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { LifecycleEventId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { createLifecycleEvent, listLifecycleEvents, getLifecycleEvent } =
  await import("../../services/lifecycle-event.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const EVENT_ID = "evt_test-event" as LifecycleEventId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeLifecycleEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    systemId: SYSTEM_ID,
    eventType: "discovery",
    occurredAt: 900,
    recordedAt: 1000,
    encryptedData: new Uint8Array([1, 2, 3]),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createLifecycleEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a lifecycle event and writes audit log", async () => {
    const { db, chain } = mockDb();
    const row = makeLifecycleEventRow();
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createLifecycleEvent(
      db,
      SYSTEM_ID,
      { eventType: "discovery", occurredAt: 900, encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(EVENT_ID);
    expect(result.eventType).toBe("discovery");
    expect(result.occurredAt).toBe(900);
    expect(result.recordedAt).toBe(1000);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "lifecycle-event.created" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );
    const { db } = mockDb();

    await expect(
      createLifecycleEvent(
        db,
        SYSTEM_ID,
        { eventType: "discovery", occurredAt: 900, encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      createLifecycleEvent(db, SYSTEM_ID, { invalid: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for invalid eventType", async () => {
    const { db } = mockDb();

    await expect(
      createLifecycleEvent(
        db,
        SYSTEM_ID,
        { eventType: "not-a-valid-event-type", occurredAt: 900, encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("listLifecycleEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lifecycle events for the system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(EVENT_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns events filtered by eventType", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ eventType: "split" })]);

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH, undefined, 25, "split");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.eventType).toBe("split");
    expect(chain.where).toHaveBeenCalled();
  });

  it("applies cursor when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const cursor = Buffer.from(JSON.stringify({ occurredAt: 500, id: "evt_old" })).toString(
      "base64",
    );

    await listLifecycleEvents(db, SYSTEM_ID, AUTH, cursor);

    expect(chain.where).toHaveBeenCalled();
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeLifecycleEventRow({ id: "evt_a", occurredAt: 900 }),
      makeLifecycleEventRow({ id: "evt_b", occurredAt: 800 }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns empty page when no events exist", async () => {
    const { db } = mockDb();

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});

describe("getLifecycleEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lifecycle event when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);

    const result = await getLifecycleEvent(db, SYSTEM_ID, EVENT_ID, AUTH);

    expect(result.id).toBe(EVENT_ID);
    expect(result.eventType).toBe("discovery");
    expect(result.occurredAt).toBe(900);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws 404 when event not found", async () => {
    const { db } = mockDb();

    await expect(
      getLifecycleEvent(db, SYSTEM_ID, "evt_nonexistent" as LifecycleEventId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
