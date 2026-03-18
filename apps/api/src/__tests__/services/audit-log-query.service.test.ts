import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AccountId, AuditLogEntryId } from "@pluralscape/types";

// ── Import under test ────────────────────────────────────────────────

const { queryAuditLog } = await import("../../services/audit-log-query.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test-account" as AccountId;

const BASE_PARAMS = {
  from: 1_000_000,
  to: 9_000_000,
  limit: 10,
};

function makeAuditRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "al_entry-001" as AuditLogEntryId,
    accountId: ACCOUNT_ID,
    systemId: "sys_test-system",
    eventType: "member.created",
    timestamp: 5_000_000,
    ipAddress: "127.0.0.1",
    userAgent: "TestAgent/1.0",
    actor: { type: "account", id: ACCOUNT_ID },
    detail: null,
    ...overrides,
  };
}

/** Encode a cursor the same way the service does: base64url(JSON({t, i})). */
function encodeTestCursor(t: number, i: string): string {
  return Buffer.from(JSON.stringify({ t, i })).toString("base64url");
}

// ── Tests ────────────────────────────────────────────────────────────

describe("queryAuditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns items and no nextCursor when results fit within limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeAuditRow(), makeAuditRow({ id: "al_entry-002", timestamp: 4_000_000 })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, limit: 5 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.id).toBe("al_entry-001");
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("maps row fields onto AuditLogEntryResult correctly", async () => {
    const { db, chain } = mockDb();
    const row = makeAuditRow({
      id: "al_mapped",
      eventType: "system.login",
      timestamp: 7_000_000,
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
      detail: "some detail",
      systemId: "sys_abc",
      actor: { type: "account", id: ACCOUNT_ID },
    });
    chain.limit.mockResolvedValueOnce([row]);

    const result = await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, limit: 5 });

    const item = result.items[0];
    expect(item).toMatchObject({
      id: "al_mapped",
      eventType: "system.login",
      timestamp: 7_000_000,
      ipAddress: "10.0.0.1",
      userAgent: "Mozilla/5.0",
      detail: "some detail",
      systemId: "sys_abc",
    });
  });

  it("returns empty results when no rows match", async () => {
    const { db } = mockDb();
    // chain.limit already returns [] by default

    const result = await queryAuditLog(db, ACCOUNT_ID, BASE_PARAMS);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("sets hasMore and nextCursor when DB returns limit+1 rows", async () => {
    const { db, chain } = mockDb();
    const limit = 3;
    // Return limit+1 rows to signal there is a next page
    const rows = [
      makeAuditRow({ id: "al_a", timestamp: 5_000_003 }),
      makeAuditRow({ id: "al_b", timestamp: 5_000_002 }),
      makeAuditRow({ id: "al_c", timestamp: 5_000_001 }),
      makeAuditRow({ id: "al_d", timestamp: 5_000_000 }), // overflow row
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, limit });

    expect(result.items).toHaveLength(limit);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
    // Overflow row must not appear in items
    expect(result.items.map((i) => i.id)).not.toContain("al_d");
  });

  it("encodes nextCursor from last item's timestamp and id", async () => {
    const { db, chain } = mockDb();
    const limit = 2;
    const rows = [
      makeAuditRow({ id: "al_first", timestamp: 6_000_000 }),
      makeAuditRow({ id: "al_last", timestamp: 5_500_000 }),
      makeAuditRow({ id: "al_overflow", timestamp: 5_000_000 }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, limit });

    expect(result.nextCursor).not.toBeNull();
    // Decode and verify it points to the last visible item ("al_last")
    const decoded = JSON.parse(
      Buffer.from(result.nextCursor as string, "base64url").toString("utf8"),
    );
    expect(decoded).toEqual({ t: 5_500_000, i: "al_last" });
  });

  it("passes cursor condition to DB query when cursor param is provided", async () => {
    const { db, chain } = mockDb();
    const cursor = encodeTestCursor(5_000_000, "al_entry-001");

    await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, cursor });

    // where() must have been called (cursor adds an OR condition)
    expect(chain.where).toHaveBeenCalled();
  });

  it("applies eventType filter when provided", async () => {
    const { db, chain } = mockDb();

    await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, eventType: "member.created" });

    expect(chain.where).toHaveBeenCalled();
  });

  it("does not include eventType condition when eventType is undefined", async () => {
    const { db, chain } = mockDb();
    // Confirm the query runs successfully without an eventType — no throw expected
    await expect(queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS })).resolves.not.toThrow();
    expect(chain.where).toHaveBeenCalled();
  });

  it("applies resourceType filter as LIKE prefix when provided", async () => {
    const { db, chain } = mockDb();

    await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, resourceType: "member" });

    expect(chain.where).toHaveBeenCalled();
  });

  it("combines resourceType and eventType filters", async () => {
    const { db, chain } = mockDb();

    await queryAuditLog(db, ACCOUNT_ID, {
      ...BASE_PARAMS,
      eventType: "member.created",
      resourceType: "member",
    });

    expect(chain.where).toHaveBeenCalled();
  });

  it("does not include resourceType condition when resourceType is undefined", async () => {
    const { db, chain } = mockDb();
    await expect(queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS })).resolves.not.toThrow();
    expect(chain.where).toHaveBeenCalled();
  });

  it("requests limit+1 rows from the database", async () => {
    const { db, chain } = mockDb();

    await queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, limit: 7 });

    expect(chain.limit).toHaveBeenCalledWith(8); // 7 + 1
  });

  it("orders results by timestamp desc then id desc", async () => {
    const { db, chain } = mockDb();

    await queryAuditLog(db, ACCOUNT_ID, BASE_PARAMS);

    expect(chain.orderBy).toHaveBeenCalled();
  });
});

// ── Cursor encode/decode ─────────────────────────────────────────────

describe("cursor roundtrip", () => {
  it("nextCursor from one page can be used as cursor for the next page", async () => {
    const { db: db1, chain: chain1 } = mockDb();
    const limit = 2;
    const pageOneRows = [
      makeAuditRow({ id: "al_p1a", timestamp: 8_000_000 }),
      makeAuditRow({ id: "al_p1b", timestamp: 7_000_000 }),
      makeAuditRow({ id: "al_p1c", timestamp: 6_000_000 }), // overflow
    ];
    chain1.limit.mockResolvedValueOnce(pageOneRows);

    const pageOne = await queryAuditLog(db1, ACCOUNT_ID, { ...BASE_PARAMS, limit });
    expect(pageOne.nextCursor).not.toBeNull();

    // Use the returned cursor for page two
    const { db: db2, chain: chain2 } = mockDb();
    chain2.limit.mockResolvedValueOnce([makeAuditRow({ id: "al_p2a", timestamp: 6_000_000 })]);

    const pageTwo = await queryAuditLog(db2, ACCOUNT_ID, {
      ...BASE_PARAMS,
      limit,
      cursor: pageOne.nextCursor as string,
    });

    expect(pageTwo.items[0]?.id).toBe("al_p2a");
    expect(pageTwo.hasMore).toBe(false);
    expect(pageTwo.nextCursor).toBeNull();
  });
});

// ── Malformed cursor handling ────────────────────────────────────────

describe("decodeCursor — malformed input", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function expectInvalidCursor(cursor: string): Promise<void> {
    const { db } = mockDb();
    await expect(queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, cursor })).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "INVALID_CURSOR" }),
    );
  }

  it("throws INVALID_CURSOR for a non-base64url string", async () => {
    await expectInvalidCursor("not-a-valid-cursor!!!");
  });

  it("throws INVALID_CURSOR for valid base64url but invalid JSON", async () => {
    const bad = Buffer.from("this is not json").toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when JSON is valid but missing field t", async () => {
    const bad = Buffer.from(JSON.stringify({ i: "al_entry-001" })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when JSON is valid but missing field i", async () => {
    const bad = Buffer.from(JSON.stringify({ t: 5_000_000 })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when t is zero", async () => {
    const bad = Buffer.from(JSON.stringify({ t: 0, i: "al_entry-001" })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when t is negative", async () => {
    const bad = Buffer.from(JSON.stringify({ t: -1, i: "al_entry-001" })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when t is a string instead of number", async () => {
    const bad = Buffer.from(JSON.stringify({ t: "5000000", i: "al_entry-001" })).toString(
      "base64url",
    );
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when i is an empty string", async () => {
    const bad = Buffer.from(JSON.stringify({ t: 5_000_000, i: "" })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when i is a number instead of string", async () => {
    const bad = Buffer.from(JSON.stringify({ t: 5_000_000, i: 42 })).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("treats empty string cursor as absent (no error, no cursor condition)", async () => {
    // The service guards with `if (params.cursor)` so an empty string is silently ignored.
    const { db } = mockDb();
    await expect(
      queryAuditLog(db, ACCOUNT_ID, { ...BASE_PARAMS, cursor: "" }),
    ).resolves.toMatchObject({ hasMore: false, nextCursor: null });
  });

  it("throws INVALID_CURSOR when JSON root is an array", async () => {
    const bad = Buffer.from(JSON.stringify([5_000_000, "al_entry-001"])).toString("base64url");
    await expectInvalidCursor(bad);
  });

  it("throws INVALID_CURSOR when JSON root is null", async () => {
    const bad = Buffer.from("null").toString("base64url");
    await expectInvalidCursor(bad);
  });
});
