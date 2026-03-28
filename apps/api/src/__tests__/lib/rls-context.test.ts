import * as db from "@pluralscape/db";
import { afterEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted by Vitest. The factory runs before module-level variable
// assignments, so mocks are created inline and retrieved via vi.mocked() below.
vi.mock("@pluralscape/db", () => ({
  setTenantContext: vi.fn(),
  setAccountId: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────────────────

import {
  withAccountRead,
  withAccountTransaction,
  withCrossAccountRead,
  withTenantRead,
  withTenantTransaction,
} from "../../lib/rls-context.js";
import { asDb } from "../helpers/mock-db.js";

import type { AccountId, SystemId } from "@pluralscape/types";

// ── Typed references to mocked functions ─────────────────────────────────────

const mockSetTenantContext = vi.mocked(db.setTenantContext);
const mockSetAccountId = vi.mocked(db.setAccountId);

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTx(): { execute: ReturnType<typeof vi.fn> } {
  return { execute: vi.fn() };
}

type MockTx = ReturnType<typeof makeTx>;

function createMockDb(): { db: ReturnType<typeof asDb>; tx: MockTx } {
  const tx = makeTx();
  const mockDb = asDb({
    transaction: vi.fn(async (fn: (tx: MockTx) => Promise<unknown>) => fn(tx)),
  });
  return { db: mockDb, tx };
}

function makeContext(): { systemId: SystemId; accountId: AccountId } {
  return {
    systemId: crypto.randomUUID() as SystemId,
    accountId: crypto.randomUUID() as AccountId,
  };
}

// ── Parameterized test cases ─────────────────────────────────────────────────

interface RlsTestCase {
  name: string;
  fn: (...args: never[]) => Promise<unknown>;
  setupFn: "setTenantContext" | "setAccountId";
  readOnly: boolean;
  callArgs: (db: ReturnType<typeof asDb>, callback: ReturnType<typeof vi.fn>) => unknown[];
}

const cases: RlsTestCase[] = [
  {
    name: "withTenantTransaction",
    fn: withTenantTransaction as (...args: never[]) => Promise<unknown>,
    setupFn: "setTenantContext",
    readOnly: false,
    callArgs: (db, callback) => {
      const ctx = makeContext();
      return [db, ctx, callback];
    },
  },
  {
    name: "withTenantRead",
    fn: withTenantRead as (...args: never[]) => Promise<unknown>,
    setupFn: "setTenantContext",
    readOnly: true,
    callArgs: (db, callback) => {
      const ctx = makeContext();
      return [db, ctx, callback];
    },
  },
  {
    name: "withAccountTransaction",
    fn: withAccountTransaction as (...args: never[]) => Promise<unknown>,
    setupFn: "setAccountId",
    readOnly: false,
    callArgs: (db, callback) => {
      const accountId = crypto.randomUUID() as AccountId;
      return [db, accountId, callback];
    },
  },
  {
    name: "withAccountRead",
    fn: withAccountRead as (...args: never[]) => Promise<unknown>,
    setupFn: "setAccountId",
    readOnly: true,
    callArgs: (db, callback) => {
      const accountId = crypto.randomUUID() as AccountId;
      return [db, accountId, callback];
    },
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe.each(cases)("$name", ({ fn, setupFn, readOnly, callArgs }) => {
  const mockSetup = setupFn === "setTenantContext" ? mockSetTenantContext : mockSetAccountId;

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("calls setup function before invoking the callback", async () => {
    const { db: mockDb } = createMockDb();
    const callback = vi.fn().mockResolvedValue("ok");
    const args = callArgs(mockDb, callback);

    await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

    expect(mockSetup).toHaveBeenCalledOnce();
  });

  it("calls setup function BEFORE the user callback", async () => {
    const { db: mockDb } = createMockDb();
    const callOrder: string[] = [];

    mockSetup.mockImplementation(() => {
      callOrder.push(setupFn);
      return Promise.resolve();
    });

    const callback = vi.fn().mockImplementation(() => {
      callOrder.push("callback");
      return Promise.resolve("done");
    });

    const args = callArgs(mockDb, callback);
    await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

    expect(callOrder[0]).toBe(setupFn);
    expect(callOrder).toContain("callback");
    expect(callOrder.indexOf(setupFn)).toBeLessThan(callOrder.indexOf("callback"));
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = { data: crypto.randomUUID() };
    const callback = vi.fn().mockResolvedValue(expected);

    const args = callArgs(mockDb, callback);
    const result = await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    const args = callArgs(mockDb, callback);
    await expect((fn as (...a: unknown[]) => Promise<unknown>)(...args)).rejects.toThrow(error);
  });

  if (readOnly) {
    it("executes SET TRANSACTION READ ONLY", async () => {
      const { db: mockDb, tx } = createMockDb();
      const callback = vi.fn().mockResolvedValue("ok");

      const args = callArgs(mockDb, callback);
      await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

      // Read variants call tx.execute(sql`SET TRANSACTION READ ONLY`).
      // setTenantContext/setAccountId are mocked stubs, so the only
      // tx.execute call comes from the READ ONLY enforcement.
      expect(tx.execute).toHaveBeenCalledOnce();
      const sqlArg = tx.execute.mock.calls[0]?.[0] as { queryChunks: { value: string[] }[] };
      // The drizzle sql tag stores raw strings in queryChunks.
      // Verify the SQL object contains the READ ONLY directive.
      const serialized = JSON.stringify(sqlArg);
      expect(serialized).toContain("READ ONLY");
    });
  } else {
    it("does not execute SET TRANSACTION READ ONLY", async () => {
      const { db: mockDb, tx } = createMockDb();
      const callback = vi.fn().mockResolvedValue("ok");

      const args = callArgs(mockDb, callback);
      await (fn as (...a: unknown[]) => Promise<unknown>)(...args);

      expect(tx.execute).not.toHaveBeenCalled();
    });
  }
});

// ── withCrossAccountRead ────────────────────────────────────────────────────

describe("withCrossAccountRead", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("does not set any RLS context", async () => {
    const { db: mockDb } = createMockDb();
    const callback = vi.fn().mockResolvedValue("ok");

    await withCrossAccountRead(mockDb, callback);

    expect(mockSetTenantContext).not.toHaveBeenCalled();
    expect(mockSetAccountId).not.toHaveBeenCalled();
  });

  it("executes SET TRANSACTION READ ONLY", async () => {
    const { db: mockDb, tx } = createMockDb();
    const callback = vi.fn().mockResolvedValue("ok");

    await withCrossAccountRead(mockDb, callback);

    expect(tx.execute).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(tx.execute.mock.calls[0]?.[0]);
    expect(serialized).toContain("READ ONLY");
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = { data: crypto.randomUUID() };
    const callback = vi.fn().mockResolvedValue(expected);

    const result = await withCrossAccountRead(mockDb, callback);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    await expect(withCrossAccountRead(mockDb, callback)).rejects.toThrow(error);
  });
});
