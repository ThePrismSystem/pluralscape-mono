/**
 * Unit tests for auth/sessions.ts
 *
 * Covers: listSessions, revokeSession, revokeAllSessions, logoutCurrentSession.
 */
import { PAGINATION, brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  LOG_LEVEL: "info" as const,
  TRUST_PROXY: false,
}));

vi.mock("../../../env.js", () => ({ env: mockEnv }));

import { fromCursor } from "../../../lib/pagination.js";
import {
  listSessions,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../../services/auth/sessions.js";
import { mockDb } from "../../helpers/mock-db.js";

import type { SessionRevocation } from "./internal.js";
import type { AccountId, SessionId } from "@pluralscape/types";

// ── Mock external dependencies ────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  AUTH_KEY_HASH_BYTES: 32,
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
  getSodium: () => ({ randomBytes: (n: number) => new Uint8Array(n) }),
}));

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, now: () => mockNow() };
});

// ── Fixtures ─────────────────────────────────────────────────────────

const TEST_ACCOUNT_ID = brandId<AccountId>("acct_123");
const ATTACKER_ACCOUNT_ID = brandId<AccountId>("acct_attacker");

const mockAudit = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockNow.mockReturnValue(Date.now());
  mockAudit.mockClear();
});

// ── listSessions ──────────────────────────────────────────────────────

describe("listSessions", () => {
  it("returns empty sessions array when no rows match", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listSessions(db, TEST_ACCOUNT_ID);
    expect(result.sessions).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("returns sessions without nextCursor when under the limit", async () => {
    const { db, chain } = mockDb();
    const rows = [
      { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000, encryptedData: null },
      { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100, encryptedData: null },
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSessions(db, TEST_ACCOUNT_ID);
    expect(result.sessions).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("returns nextCursor when limit+1 rows are returned", async () => {
    const { db, chain } = mockDb();
    const rows = [
      { id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: 3000, encryptedData: null },
      { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100, encryptedData: null },
      { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200, encryptedData: null },
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSessions(db, TEST_ACCOUNT_ID, undefined, 2);
    expect(result.sessions).toHaveLength(2);
    const { nextCursor } = result;
    expect(nextCursor).not.toBeNull();
    if (nextCursor) {
      expect(fromCursor(nextCursor, PAGINATION.cursorTtlMs)).toBe("sess_2");
    }
  });

  it("passes cursor as SQL condition (not in-memory filtering)", async () => {
    const { db, chain } = mockDb();
    const rows = [
      { id: "sess_2", createdAt: 1100, lastActive: 2100, expiresAt: 3100, encryptedData: null },
      { id: "sess_3", createdAt: 1200, lastActive: 2200, expiresAt: 3200, encryptedData: null },
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSessions(db, TEST_ACCOUNT_ID, "sess_1", 25);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]?.id).toBe("sess_2");
    expect(result.sessions[1]?.id).toBe("sess_3");
    expect(result.nextCursor).toBeNull();
    expect(chain.where).toHaveBeenCalled();
  });

  it("all mock-returned rows appear in output (no JS-level idle filtering)", async () => {
    const { db, chain } = mockDb();
    const fixedTime = 700_000_000;
    mockNow.mockReturnValue(fixedTime);
    const rows = [
      { id: "sess_1", createdAt: 0, lastActive: 1, expiresAt: 2_592_000_000, encryptedData: null },
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSessions(db, TEST_ACCOUNT_ID);
    expect(result.sessions).toHaveLength(1);
  });

  it("includes sessions returned by database without post-filtering", async () => {
    const { db, chain } = mockDb();
    const fixedTime = 1_000_000;
    mockNow.mockReturnValue(fixedTime);
    const rows = [
      {
        id: "sess_1",
        createdAt: fixedTime - 1000,
        lastActive: fixedTime - 500,
        expiresAt: fixedTime + 2_592_000_000,
        encryptedData: null,
      },
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSessions(db, TEST_ACCOUNT_ID);
    expect(result.sessions).toHaveLength(1);
  });
});

// ── revokeSession ─────────────────────────────────────────────────────

describe("revokeSession", () => {
  it("returns false when session is not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    const result = await revokeSession(
      db,
      brandId<SessionId>("sess_999"),
      TEST_ACCOUNT_ID,
      mockAudit,
    );
    expect(result).toBe(false);
  });

  it("returns false when session belongs to a different account", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    const result = await revokeSession(
      db,
      brandId<SessionId>("sess_1"),
      TEST_ACCOUNT_ID,
      mockAudit,
    );
    expect(result).toBe(false);
  });

  it("returns true and revokes session when actor owns it", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

    const result = await revokeSession(
      db,
      brandId<SessionId>("sess_1"),
      TEST_ACCOUNT_ID,
      mockAudit,
    );
    expect(result).toBe(true);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("returns false for cross-account revocation without modifying the session", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    const result = await revokeSession(
      db,
      brandId<SessionId>("sess_target"),
      ATTACKER_ACCOUNT_ID,
      mockAudit,
    );
    expect(result).toBe(false);
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("returns false when session is already revoked", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    const result = await revokeSession(
      db,
      brandId<SessionId>("sess_1"),
      TEST_ACCOUNT_ID,
      mockAudit,
    );
    expect(result).toBe(false);
  });
});

// ── revokeAllSessions ─────────────────────────────────────────────────

describe("revokeAllSessions", () => {
  it("returns 0 when no sessions are revoked", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    const count = await revokeAllSessions(
      db,
      TEST_ACCOUNT_ID,
      brandId<SessionId>("sess_keep"),
      mockAudit,
    );
    expect(count).toBe(0);
  });

  it("returns the count of revoked sessions", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: "sess_1" }, { id: "sess_2" }, { id: "sess_3" }]);

    const count = await revokeAllSessions(
      db,
      TEST_ACCOUNT_ID,
      brandId<SessionId>("sess_keep"),
      mockAudit,
    );
    expect(count).toBe(3);
  });

  it("calls update with revoked: true", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: "sess_1" }]);

    await revokeAllSessions(db, TEST_ACCOUNT_ID, brandId<SessionId>("sess_keep"), mockAudit);
    expect(chain.set).toHaveBeenCalledWith({ revoked: true } satisfies SessionRevocation);
  });
});

// ── logoutCurrentSession ──────────────────────────────────────────────

describe("logoutCurrentSession", () => {
  it("revokes the session and returns void", async () => {
    const { db, chain } = mockDb();

    await logoutCurrentSession(db, brandId<SessionId>("sess_1"), TEST_ACCOUNT_ID, mockAudit);
    expect(chain.update).toHaveBeenCalled();
    expect(chain.set).toHaveBeenCalledWith({ revoked: true } satisfies SessionRevocation);
  });

  it("works with mock audit writer", async () => {
    const { db } = mockDb();

    await expect(
      logoutCurrentSession(db, brandId<SessionId>("sess_1"), TEST_ACCOUNT_ID, mockAudit),
    ).resolves.toBeUndefined();
  });
});
