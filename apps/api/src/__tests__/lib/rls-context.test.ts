import * as db from "@pluralscape/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("withTenantTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls setTenantContext with the tx and context before invoking the callback", async () => {
    const { db: mockDb, tx } = createMockDb();
    const context = makeContext();
    const callback = vi.fn().mockResolvedValue("ok");

    await withTenantTransaction(mockDb, context, callback);

    expect(mockSetTenantContext).toHaveBeenCalledOnce();
    expect(mockSetTenantContext).toHaveBeenCalledWith(tx, context);
  });

  it("calls setTenantContext BEFORE the user callback", async () => {
    const { db: mockDb } = createMockDb();
    const context = makeContext();
    const callOrder: string[] = [];

    mockSetTenantContext.mockImplementation(() => {
      callOrder.push("setTenantContext");
      return Promise.resolve();
    });

    const callback = vi.fn().mockImplementation(() => {
      callOrder.push("callback");
      return Promise.resolve("done");
    });

    await withTenantTransaction(mockDb, context, callback);

    expect(callOrder).toEqual(["setTenantContext", "callback"]);
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = { data: crypto.randomUUID() };
    const callback = vi.fn().mockResolvedValue(expected);

    const result = await withTenantTransaction(mockDb, makeContext(), callback);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`tx-error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    await expect(withTenantTransaction(mockDb, makeContext(), callback)).rejects.toThrow(error);
  });
});

describe("withTenantRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls setTenantContext with the tx and context before invoking the callback", async () => {
    const { db: mockDb, tx } = createMockDb();
    const context = makeContext();
    const callback = vi.fn().mockResolvedValue("ok");

    await withTenantRead(mockDb, context, callback);

    expect(mockSetTenantContext).toHaveBeenCalledOnce();
    expect(mockSetTenantContext).toHaveBeenCalledWith(tx, context);
  });

  it("calls setTenantContext BEFORE the user callback", async () => {
    const { db: mockDb } = createMockDb();
    const callOrder: string[] = [];

    mockSetTenantContext.mockImplementation(() => {
      callOrder.push("setTenantContext");
      return Promise.resolve();
    });

    const callback = vi.fn().mockImplementation(() => {
      callOrder.push("callback");
      return Promise.resolve();
    });

    await withTenantRead(mockDb, makeContext(), callback);

    expect(callOrder).toEqual(["setTenantContext", "callback"]);
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = [crypto.randomUUID(), crypto.randomUUID()];
    const callback = vi.fn().mockResolvedValue(expected);

    const result = await withTenantRead(mockDb, makeContext(), callback);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`read-error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    await expect(withTenantRead(mockDb, makeContext(), callback)).rejects.toThrow(error);
  });
});

describe("withAccountTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls setAccountId with the tx and accountId before invoking the callback", async () => {
    const { db: mockDb, tx } = createMockDb();
    const accountId = crypto.randomUUID() as AccountId;
    const callback = vi.fn().mockResolvedValue("ok");

    await withAccountTransaction(mockDb, accountId, callback);

    expect(mockSetAccountId).toHaveBeenCalledOnce();
    expect(mockSetAccountId).toHaveBeenCalledWith(tx, accountId);
  });

  it("calls setAccountId BEFORE the user callback", async () => {
    const { db: mockDb } = createMockDb();
    const callOrder: string[] = [];

    mockSetAccountId.mockImplementation(() => {
      callOrder.push("setAccountId");
      return Promise.resolve();
    });

    const callback = vi.fn().mockImplementation(() => {
      callOrder.push("callback");
      return Promise.resolve();
    });

    await withAccountTransaction(mockDb, crypto.randomUUID() as AccountId, callback);

    expect(callOrder).toEqual(["setAccountId", "callback"]);
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = { rows: [{ id: crypto.randomUUID() }] };
    const callback = vi.fn().mockResolvedValue(expected);

    const result = await withAccountTransaction(mockDb, crypto.randomUUID() as AccountId, callback);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`acct-tx-error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      withAccountTransaction(mockDb, crypto.randomUUID() as AccountId, callback),
    ).rejects.toThrow(error);
  });
});

describe("withAccountRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls setAccountId with the tx and accountId before invoking the callback", async () => {
    const { db: mockDb, tx } = createMockDb();
    const accountId = crypto.randomUUID() as AccountId;
    const callback = vi.fn().mockResolvedValue("ok");

    await withAccountRead(mockDb, accountId, callback);

    expect(mockSetAccountId).toHaveBeenCalledOnce();
    expect(mockSetAccountId).toHaveBeenCalledWith(tx, accountId);
  });

  it("calls setAccountId BEFORE the user callback", async () => {
    const { db: mockDb } = createMockDb();
    const callOrder: string[] = [];

    mockSetAccountId.mockImplementation(() => {
      callOrder.push("setAccountId");
      return Promise.resolve();
    });

    const callback = vi.fn().mockImplementation(() => {
      callOrder.push("callback");
      return Promise.resolve();
    });

    await withAccountRead(mockDb, crypto.randomUUID() as AccountId, callback);

    expect(callOrder).toEqual(["setAccountId", "callback"]);
  });

  it("returns the value from the callback", async () => {
    const { db: mockDb } = createMockDb();
    const expected = { count: 42 };
    const callback = vi.fn().mockResolvedValue(expected);

    const result = await withAccountRead(mockDb, crypto.randomUUID() as AccountId, callback);

    expect(result).toBe(expected);
  });

  it("propagates errors thrown by the callback", async () => {
    const { db: mockDb } = createMockDb();
    const error = new Error(`acct-read-error-${crypto.randomUUID()}`);
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      withAccountRead(mockDb, crypto.randomUUID() as AccountId, callback),
    ).rejects.toThrow(error);
  });
});
