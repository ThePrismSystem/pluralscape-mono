import { afterEach, describe, expect, it, vi } from "vitest";

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

// Mock @pluralscape/db/pg — schema tables are used only as column references
vi.mock("@pluralscape/db/pg", () => ({
  accounts: { id: "accounts.id", accountType: "accounts.accountType" },
  sessions: {
    id: "sessions.id",
    accountId: "sessions.accountId",
    revoked: "sessions.revoked",
    expiresAt: "sessions.expiresAt",
    createdAt: "sessions.createdAt",
    lastActive: "sessions.lastActive",
  },
  systems: { id: "systems.id", accountId: "systems.accountId" },
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

import { validateSession } from "../../lib/session-auth.js";

// ── Helpers ──────────────────────────────────────────────────────────

interface MockSession {
  id: string;
  accountId: string;
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
    revoked: false,
    createdAt: 1_000_000,
    expiresAt: 1_000_000 + 2_592_000_000, // +30 days (web session)
    lastActive: 1_000_000 + 100_000,
    encryptedData: null,
    ...overrides,
  };
}

/**
 * Creates a mock DB that supports the JOIN query pattern:
 * `.select().from().innerJoin().leftJoin().where().limit()`
 *
 * Returns a single joined result row (or empty array if no match).
 */
function createMockDb(
  joinResult: Array<{
    session: MockSession;
    accountType: string;
    systemId: string | null;
  }> = [],
) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(joinResult),
  };
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
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_001" }]);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns SESSION_EXPIRED when absolute TTL is exceeded", async () => {
    const session = makeSession({ expiresAt: 2_000_000 });
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_001" }]);
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
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_001" }]);
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
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_001" }]);
    // Now is lastActive + 30 days + 1ms (just past idle timeout)
    mockNow.mockReturnValue(lastActive + 2_592_000_000 + 1);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns valid AuthContext for a system account", async () => {
    const session = makeSession();
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_001" }]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: {
        accountId: session.accountId,
        systemId: "sys_001",
        sessionId: session.id,
        accountType: "system",
      },
      session,
    });
  });

  it("returns valid AuthContext for a viewer account (no system lookup)", async () => {
    const session = makeSession();
    const db = createMockDb([{ session, accountType: "viewer", systemId: null }]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: {
        accountId: session.accountId,
        systemId: null,
        sessionId: session.id,
        accountType: "viewer",
      },
      session,
    });
  });

  it("returns null systemId when system account has no system row", async () => {
    const session = makeSession();
    // leftJoin returns null for systemId when no system row
    const db = createMockDb([{ session, accountType: "system", systemId: null }]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({
      ok: true,
      auth: {
        accountId: session.accountId,
        systemId: null,
        sessionId: session.id,
        accountType: "system",
      },
      session,
    });
  });

  it("does not expire when expiresAt is null (no absolute TTL)", async () => {
    const session = makeSession({ expiresAt: null, lastActive: null });
    const db = createMockDb([{ session, accountType: "system", systemId: "sys_002" }]);
    mockNow.mockReturnValue(999_999_999_999);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("does not idle-expire when lastActive is null", async () => {
    const session = makeSession({ lastActive: null });
    const db = createMockDb([{ session, accountType: "viewer", systemId: null }]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("allows session that is exactly at expiresAt boundary", async () => {
    const session = makeSession({ expiresAt: 5_000_000 });
    const db = createMockDb([{ session, accountType: "viewer", systemId: null }]);
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
    const db = createMockDb([{ session, accountType: "viewer", systemId: null }]);
    mockNow.mockReturnValue(createdAt + 200_000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });
});
