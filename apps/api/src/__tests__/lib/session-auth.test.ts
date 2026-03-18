import { afterEach, describe, expect, it, vi } from "vitest";

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

// Mock @pluralscape/db/pg — schema tables are used only as column references
vi.mock("@pluralscape/db/pg", () => ({
  accounts: { id: "accounts.id", accountType: "accounts.accountType" },
  sessions: {
    id: "sessions.id",
    accountId: "sessions.accountId",
    tokenHash: "sessions.tokenHash",
    revoked: "sessions.revoked",
    expiresAt: "sessions.expiresAt",
    createdAt: "sessions.createdAt",
    lastActive: "sessions.lastActive",
  },
  systems: { id: "systems.id", accountId: "systems.accountId", archived: "systems.archived" },
}));

// Mock session-token module used by session-auth for hashing
vi.mock("../../lib/session-token.js", () => ({
  hashSessionToken: (token: string) => `hashed_${token}`,
}));

// Mock the `now()` function so we can control the current time
const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    now: () => mockNow(),
  };
});

import { getIdleTimeout, validateSession } from "../../lib/session-auth.js";

// ── Helpers ──────────────────────────────────────────────────────────

interface MockSession {
  id: string;
  accountId: string;
  tokenHash: string;
  revoked: boolean;
  createdAt: number;
  expiresAt: number | null;
  lastActive: number | null;
  encryptedData: null;
}

function makeSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: "sess_abc123",
    accountId: "acct_xyz",
    tokenHash: "hashed_test_token",
    revoked: false,
    createdAt: 1_000_000,
    expiresAt: 1_000_000 + 2_592_000_000, // +30 days (web session)
    lastActive: 1_000_000 + 100_000,
    encryptedData: null,
    ...overrides,
  };
}

/**
 * Creates a mock DB that supports:
 * 1. Session query: `.select().from().innerJoin().where().limit()`
 * 2. Systems query: `.select().from().where().orderBy()` (for system accounts only)
 *
 * The first `.limit()` call resolves with sessionResult.
 * Subsequent `.where()` calls resolve with a chain ending in `.orderBy()`.
 */
function createMockDb(
  sessionResult: Array<{
    session: MockSession;
    accountType: string;
  }> = [],
  systemRows: Array<{ id: string }> = [],
) {
  let queryCount = 0;
  const db = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) {
        // Session query — returns chain with .limit()
        return { limit: vi.fn().mockResolvedValue(sessionResult) };
      }
      // Systems query — returns chain with .orderBy()
      return { orderBy: vi.fn().mockResolvedValue(systemRows) };
    }),
  };
  return db;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("validateSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns UNAUTHENTICATED when session does not exist", async () => {
    const db = createMockDb([]);
    const result = await validateSession(db as never, "sess_nonexistent");

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns UNAUTHENTICATED when session is revoked", async () => {
    const session = makeSession({ revoked: true });
    const db = createMockDb([{ session, accountType: "system" }]);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns SESSION_EXPIRED when absolute TTL is exceeded", async () => {
    const session = makeSession({ expiresAt: 2_000_000 });
    const db = createMockDb([{ session, accountType: "system" }]);
    mockNow.mockReturnValue(2_000_001);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns SESSION_EXPIRED when idle timeout is exceeded for web session", async () => {
    const createdAt = 1_000_000;
    const lastActive = createdAt + 100_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 2_592_000_000, // +30 days (web)
      lastActive,
    });
    const db = createMockDb([{ session, accountType: "system" }]);
    // Now is lastActive + 7 days + 1ms (just past idle timeout)
    mockNow.mockReturnValue(lastActive + 604_800_000 + 1);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns SESSION_EXPIRED when idle timeout is exceeded for mobile session", async () => {
    const createdAt = 1_000_000;
    const lastActive = createdAt + 100_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 7_776_000_000, // +90 days (mobile)
      lastActive,
    });
    const db = createMockDb([{ session, accountType: "system" }]);
    // Now is lastActive + 30 days + 1ms (just past idle timeout)
    mockNow.mockReturnValue(lastActive + 2_592_000_000 + 1);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns valid AuthContext with ownedSystemIds for a system account", async () => {
    const session = makeSession();
    const db = createMockDb([{ session, accountType: "system" }], [{ id: "sys_001" }]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: expect.objectContaining({
        accountId: session.accountId,
        systemId: "sys_001",
        sessionId: session.id,
        accountType: "system",
      }),
      session,
    });
    if (result.ok) {
      expect(result.auth.ownedSystemIds).toEqual(new Set(["sys_001"]));
    }
  });

  it("returns empty ownedSystemIds for a viewer account", async () => {
    const session = makeSession();
    const db = createMockDb([{ session, accountType: "viewer" }], []);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: expect.objectContaining({
        accountId: session.accountId,
        systemId: null,
        sessionId: session.id,
        accountType: "viewer",
      }),
      session,
    });
    if (result.ok) {
      expect(result.auth.ownedSystemIds).toEqual(new Set());
    }
  });

  it("returns null systemId when system account has no system row", async () => {
    const session = makeSession();
    const db = createMockDb([{ session, accountType: "system" }], []);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: expect.objectContaining({
        accountId: session.accountId,
        systemId: null,
        sessionId: session.id,
        accountType: "system",
      }),
      session,
    });
  });

  it("does not expire when expiresAt is null (no absolute TTL)", async () => {
    const session = makeSession({ expiresAt: null, lastActive: null });
    const db = createMockDb([{ session, accountType: "system" }], [{ id: "sys_002" }]);
    mockNow.mockReturnValue(999_999_999_999);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("does not idle-expire when lastActive is null", async () => {
    const session = makeSession({ lastActive: null });
    const db = createMockDb([{ session, accountType: "viewer" }], []);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("allows session that is exactly at expiresAt boundary", async () => {
    const session = makeSession({ expiresAt: 5_000_000 });
    const db = createMockDb([{ session, accountType: "viewer" }], []);
    mockNow.mockReturnValue(5_000_000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("does not apply idle timeout for short-lived device transfer sessions", async () => {
    const createdAt = 1_000_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 300_000, // 5 minutes
      lastActive: createdAt + 100_000,
    });
    const db = createMockDb([{ session, accountType: "viewer" }], []);
    mockNow.mockReturnValue(createdAt + 200_000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("returns multiple system IDs in ownedSystemIds", async () => {
    const session = makeSession();
    const db = createMockDb(
      [{ session, accountType: "system" }],
      [{ id: "sys_001" }, { id: "sys_002" }],
    );
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    if (result.ok) {
      expect(result.auth.ownedSystemIds).toEqual(new Set(["sys_001", "sys_002"]));
      expect(result.auth.systemId).toBe("sys_001");
    }
  });
});

describe("getIdleTimeout", () => {
  it("returns 604_800_000 (7 days) for web session TTL", () => {
    const result = getIdleTimeout({ createdAt: 0, expiresAt: 2_592_000_000 });
    expect(result).toBe(604_800_000);
  });

  it("returns 2_592_000_000 (30 days) for mobile session TTL", () => {
    const result = getIdleTimeout({ createdAt: 0, expiresAt: 7_776_000_000 });
    expect(result).toBe(2_592_000_000);
  });

  it("returns null for device transfer TTL (300_000)", () => {
    const result = getIdleTimeout({ createdAt: 0, expiresAt: 300_000 });
    expect(result).toBeNull();
  });

  it("returns null when expiresAt is null", () => {
    const result = getIdleTimeout({ createdAt: 0, expiresAt: null });
    expect(result).toBeNull();
  });

  it("returns null for unknown TTL", () => {
    const result = getIdleTimeout({ createdAt: 0, expiresAt: 999_999 });
    expect(result).toBeNull();
  });

  it("returns same result regardless of createdAt when absoluteTtl matches", () => {
    const result = getIdleTimeout({ createdAt: 5_000_000, expiresAt: 5_000_000 + 2_592_000_000 });
    expect(result).toBe(604_800_000);
  });
});
