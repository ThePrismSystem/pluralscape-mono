import { afterEach, describe, expect, it, vi } from "vitest";

// Mock drizzle-orm so `eq` returns a recognizable sentinel
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

// Mock @pluralscape/db/pg — schema tables are used only as column references
vi.mock("@pluralscape/db/pg", () => ({
  accounts: { id: "accounts.id", accountType: "accounts.accountType" },
  sessions: { id: "sessions.id", accountId: "sessions.accountId" },
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
 * Creates a mock DB where `.select().from().where().limit()` returns different
 * results based on call order (1st = session, 2nd = account, 3rd = system).
 */
function createMockDb(queryResults: unknown[][] = []) {
  let callIndex = 0;
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const result = queryResults[callIndex] ?? [];
      callIndex++;
      return result;
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("validateSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns UNAUTHENTICATED when session does not exist", async () => {
    const db = createMockDb([[]]);
    // validateSession accepts PostgresJsDatabase; the mock satisfies the shape at runtime
    const result = await validateSession(db as never, "sess_nonexistent");

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns UNAUTHENTICATED when session is revoked", async () => {
    const session = makeSession({ revoked: true });
    const db = createMockDb([[session]]);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns SESSION_EXPIRED when absolute TTL is exceeded", async () => {
    const session = makeSession({ expiresAt: 2_000_000 });
    const db = createMockDb([[session]]);
    // Current time is past expiresAt
    mockNow.mockReturnValue(2_000_001);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns SESSION_EXPIRED when idle timeout is exceeded for web session", async () => {
    // Web session: absoluteTtl = 30 days, idle timeout = 7 days
    const createdAt = 1_000_000;
    const lastActive = createdAt + 100_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 2_592_000_000, // +30 days
      lastActive,
    });
    const db = createMockDb([[session]]);
    // Now is lastActive + 7 days + 1ms (just past idle timeout)
    mockNow.mockReturnValue(lastActive + 604_800_000 + 1);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns SESSION_EXPIRED when idle timeout is exceeded for mobile session", async () => {
    // Mobile session: absoluteTtl = 90 days, idle timeout = 30 days
    const createdAt = 1_000_000;
    const lastActive = createdAt + 100_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 7_776_000_000, // +90 days
      lastActive,
    });
    const db = createMockDb([[session]]);
    // Now is lastActive + 30 days + 1ms (just past idle timeout)
    mockNow.mockReturnValue(lastActive + 2_592_000_000 + 1);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "SESSION_EXPIRED" });
  });

  it("returns UNAUTHENTICATED when account is not found", async () => {
    const session = makeSession();
    const db = createMockDb([
      [session], // session found
      [], // account not found
    ]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("returns valid AuthContext for a system account", async () => {
    const session = makeSession();
    const db = createMockDb([
      [session], // session found
      [{ accountType: "system" }], // account found
      [{ id: "sys_001" }], // system found
    ]);
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
    const db = createMockDb([
      [session], // session found
      [{ accountType: "viewer" }], // account found (viewer)
    ]);
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
    const db = createMockDb([
      [session], // session found
      [{ accountType: "system" }], // account found
      [], // no system row
    ]);
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
    const db = createMockDb([[session], [{ accountType: "system" }], [{ id: "sys_002" }]]);
    mockNow.mockReturnValue(999_999_999_999);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("does not idle-expire when lastActive is null", async () => {
    const session = makeSession({ lastActive: null });
    const db = createMockDb([[session], [{ accountType: "viewer" }]]);
    mockNow.mockReturnValue(session.createdAt + 1000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("allows session that is exactly at expiresAt boundary", async () => {
    const session = makeSession({ expiresAt: 5_000_000 });
    const db = createMockDb([[session], [{ accountType: "viewer" }]]);
    // Exactly equal — not past, should be allowed
    mockNow.mockReturnValue(5_000_000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });

  it("does not apply idle timeout for short-lived device transfer sessions", async () => {
    // A session with a short TTL that doesn't match mobile or web thresholds
    const createdAt = 1_000_000;
    const session = makeSession({
      createdAt,
      expiresAt: createdAt + 300_000, // 5 minutes
      lastActive: createdAt + 100_000,
    });
    const db = createMockDb([[session], [{ accountType: "viewer" }]]);
    // Well past idle but within absolute TTL — should still be valid
    mockNow.mockReturnValue(createdAt + 200_000);

    const result = await validateSession(db as never, session.id);

    expect(result.ok).toBe(true);
  });
});
