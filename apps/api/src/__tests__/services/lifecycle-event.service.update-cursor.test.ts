import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const {
  updateLifecycleEvent,
  createLifecycleEvent,
  listLifecycleEvents,
  getLifecycleEvent,
} = await import("../../services/lifecycle-event.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const EVENT_ID = "evt_test-event" as LifecycleEventId;
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

type LifecycleEventRow = {
  id: string;
  systemId: string;
  eventType: string;
  occurredAt: number;
  recordedAt: number;
  updatedAt: number;
  encryptedData: Uint8Array;
  plaintextMetadata?: Record<string, unknown> | null;
  version: number;
  archived: boolean;
  archivedAt: number | null;
};

function makeLifecycleEventRow(overrides: Partial<LifecycleEventRow> = {}): LifecycleEventRow {
  return {
    id: EVENT_ID,
    systemId: SYSTEM_ID,
    eventType: "discovery",
    occurredAt: 900,
    recordedAt: 1000,
    updatedAt: 1000,
    encryptedData: new Uint8Array([1, 2, 3]),
    plaintextMetadata: null,
    version: 1,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── updateLifecycleEvent ────────────────────────────────────────────

describe("updateLifecycleEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const validUpdatePayload = {
    encryptedData: VALID_BLOB_BASE64,
    version: 1,
  };

  it("updates a lifecycle event successfully", async () => {
    const { db, chain } = mockDb();
    // First limit: current row (exists check)
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);
    // returning: updated row
    chain.returning.mockResolvedValueOnce([makeLifecycleEventRow({ version: 2, updatedAt: 2000 })]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(EVENT_ID);
    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "lifecycle-event.updated" }),
    );
  });

  it("throws NOT_FOUND when event does not exist", async () => {
    const { db } = mockDb();
    // chain.limit defaults to [] — event not found

    await expect(
      updateLifecycleEvent(db, SYSTEM_ID, EVENT_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws CONFLICT on version mismatch", async () => {
    const { db, chain } = mockDb();
    // Event exists
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ version: 2 })]);
    // But update returns no rows (version mismatch)
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      updateLifecycleEvent(db, SYSTEM_ID, EVENT_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      updateLifecycleEvent(db, SYSTEM_ID, EVENT_ID, { bad: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 on ownership failure", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      updateLifecycleEvent(db, SYSTEM_ID, EVENT_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("updates eventType when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({ eventType: "split", version: 2 }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      { ...validUpdatePayload, eventType: "split" },
      AUTH,
      mockAudit,
    );

    expect(result.eventType).toBe("split");
  });

  it("updates occurredAt when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({ occurredAt: 500, version: 2 }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      { ...validUpdatePayload, occurredAt: 500 },
      AUTH,
      mockAudit,
    );

    expect(result.occurredAt).toBe(500);
  });

  it("validates plaintextMetadata when provided with eventType", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({
        version: 2,
        plaintextMetadata: { memberIds: ["mem_test"] },
      }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      {
        ...validUpdatePayload,
        eventType: "discovery",
        plaintextMetadata: { memberIds: ["mem_test"] },
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(EVENT_ID);
  });

  it("throws VALIDATION_ERROR when plaintextMetadata is invalid for eventType", async () => {
    const { db } = mockDb();

    await expect(
      updateLifecycleEvent(
        db,
        SYSTEM_ID,
        EVENT_ID,
        {
          ...validUpdatePayload,
          eventType: "discovery",
          // discovery requires memberIds with exactly 1 element
          plaintextMetadata: { memberIds: [] },
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("skips metadata validation when eventType is not provided with plaintextMetadata", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({
        version: 2,
        plaintextMetadata: { memberIds: ["mem_test"] },
      }),
    ]);

    // No eventType means effectiveEventType is null — skips validation
    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      {
        ...validUpdatePayload,
        plaintextMetadata: { memberIds: ["mem_test"] },
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(EVENT_ID);
  });

  it("preserves current eventType when update does not include eventType", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ eventType: "split" })]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({ eventType: "split", version: 2 }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.eventType).toBe("split");
  });

  it("preserves current occurredAt when update does not include occurredAt", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ occurredAt: 777 })]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({ occurredAt: 777, version: 2 }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.occurredAt).toBe(777);
  });

  it("preserves current plaintextMetadata when not provided in update", async () => {
    const { db, chain } = mockDb();
    const existingMeta = { memberIds: ["mem_existing"] };
    chain.limit.mockResolvedValueOnce([
      makeLifecycleEventRow({ plaintextMetadata: existingMeta }),
    ]);
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({ plaintextMetadata: existingMeta, version: 2 }),
    ]);

    const result = await updateLifecycleEvent(
      db,
      SYSTEM_ID,
      EVENT_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.plaintextMetadata).toEqual(existingMeta);
  });
});

// ── createLifecycleEvent — plaintextMetadata branches ───────────────

describe("createLifecycleEvent — metadata validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates event with valid plaintextMetadata", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([
      makeLifecycleEventRow({
        plaintextMetadata: { memberIds: ["mem_test"] },
      }),
    ]);

    const result = await createLifecycleEvent(
      db,
      SYSTEM_ID,
      {
        eventType: "discovery",
        occurredAt: 900,
        encryptedData: VALID_BLOB_BASE64,
        plaintextMetadata: { memberIds: ["mem_test"] },
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(EVENT_ID);
    expect(result.plaintextMetadata).toEqual({ memberIds: ["mem_test"] });
  });

  it("throws VALIDATION_ERROR for invalid plaintextMetadata on create", async () => {
    const { db } = mockDb();

    await expect(
      createLifecycleEvent(
        db,
        SYSTEM_ID,
        {
          eventType: "discovery",
          occurredAt: 900,
          encryptedData: VALID_BLOB_BASE64,
          // discovery requires exactly 1 memberIds
          plaintextMetadata: { memberIds: [] },
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws internal error when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createLifecycleEvent(
        db,
        SYSTEM_ID,
        {
          eventType: "discovery",
          occurredAt: 900,
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create lifecycle event");
  });
});

// ── listLifecycleEvents — additional cursor and boundary branches ───

describe("listLifecycleEvents — cursor edge cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws INVALID_CURSOR for malformed cursor string", async () => {
    const { db } = mockDb();

    await expect(
      listLifecycleEvents(db, SYSTEM_ID, AUTH, "not-valid-base64-json"),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "INVALID_CURSOR" }));
  });

  it("throws INVALID_CURSOR for cursor with missing fields", async () => {
    const { db } = mockDb();
    const badCursor = Buffer.from(JSON.stringify({ occurredAt: 500 })).toString("base64");

    await expect(listLifecycleEvents(db, SYSTEM_ID, AUTH, badCursor)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_CURSOR" }),
    );
  });

  it("throws INVALID_CURSOR for cursor with wrong field types", async () => {
    const { db } = mockDb();
    const badCursor = Buffer.from(
      JSON.stringify({ occurredAt: "not-a-number", id: 123 }),
    ).toString("base64");

    await expect(listLifecycleEvents(db, SYSTEM_ID, AUTH, badCursor)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_CURSOR" }),
    );
  });

  it("includes archived events when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ archived: true, archivedAt: 999 })]);

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH, undefined, 25, undefined, true);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.archived).toBe(true);
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listLifecycleEvents(db, SYSTEM_ID, AUTH, undefined, 999_999);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("throws 404 on ownership failure for list", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(listLifecycleEvents(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

// ── toLifecycleEventResult — archivedAt mapping ─────────────────────

describe("toLifecycleEventResult mapping", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps archivedAt to null when row archivedAt is null", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ archivedAt: null })]);

    const result = await getLifecycleEvent(db, SYSTEM_ID, EVENT_ID, AUTH);

    expect(result.archivedAt).toBeNull();
  });

  it("maps archivedAt to UnixMillis when row archivedAt is a number", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow({ archivedAt: 5000 })]);

    const result = await getLifecycleEvent(db, SYSTEM_ID, EVENT_ID, AUTH);

    expect(result.archivedAt).toBe(5000);
  });

  it("maps plaintextMetadata to null when row has no metadata", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLifecycleEventRow()]);

    const result = await getLifecycleEvent(db, SYSTEM_ID, EVENT_ID, AUTH);

    expect(result.plaintextMetadata).toBeNull();
  });
});
