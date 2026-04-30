/**
 * OPFS worker dispatch tests — basic ops (init/prepare/run/all/get/close,
 * txn-begin/commit/rollback, finalize).
 *
 * Companion files: opfs-worker-cache.test.ts, opfs-worker-panic.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Upper bound on setTimeout(0) ticks allowed while waiting for the worker's
 * dispatch chain to settle.
 */
const MAX_SETTLE_TICKS = 10;

type WorkerEventType = "message" | "error" | "messageerror" | "unhandledrejection";

interface FakeSelf {
  listenersByType: Map<WorkerEventType, Array<(ev: unknown) => void>>;
  lastPosted: unknown[];
  addEventListener: (type: WorkerEventType, listener: (ev: unknown) => void) => void;
  postMessage: (msg: unknown) => void;
}

function installFakeSelf(): FakeSelf {
  const listenersByType = new Map<WorkerEventType, Array<(ev: unknown) => void>>();
  const fake: FakeSelf = {
    listenersByType,
    lastPosted: [],
    addEventListener(type, listener) {
      const arr = listenersByType.get(type) ?? [];
      arr.push(listener);
      listenersByType.set(type, arr);
    },
    postMessage(msg) {
      this.lastPosted.push(msg);
    },
  };
  Object.assign(globalThis, { self: fake });
  return fake;
}

const mockExec = vi.fn<SQLiteAPI["exec"]>();
const mockClose = vi.fn<SQLiteAPI["close"]>();
const mockOpenV2 = vi.fn<SQLiteAPI["open_v2"]>();
const mockVfsRegister = vi.fn<SQLiteAPI["vfs_register"]>();
const mockStatements = vi.fn<SQLiteAPI["statements"]>();
const mockBindCollection = vi.fn<SQLiteAPI["bind_collection"]>();
const mockStep = vi.fn<SQLiteAPI["step"]>();
const mockRow = vi.fn<SQLiteAPI["row"]>();
const mockColumnNames = vi.fn<SQLiteAPI["column_names"]>();
const mockFinalize = vi.fn<SQLiteAPI["finalize"]>();
const mockReset = vi.fn<SQLiteAPI["reset"]>();

interface MockedSqlite3 {
  exec: SQLiteAPI["exec"];
  close: SQLiteAPI["close"];
  open_v2: SQLiteAPI["open_v2"];
  vfs_register: SQLiteAPI["vfs_register"];
  statements: SQLiteAPI["statements"];
  bind_collection: SQLiteAPI["bind_collection"];
  step: SQLiteAPI["step"];
  row: SQLiteAPI["row"];
  column_names: SQLiteAPI["column_names"];
  finalize: SQLiteAPI["finalize"];
  reset: SQLiteAPI["reset"];
}

const mockSqlite3: MockedSqlite3 = {
  exec: mockExec,
  close: mockClose,
  open_v2: mockOpenV2,
  vfs_register: mockVfsRegister,
  statements: mockStatements,
  bind_collection: mockBindCollection,
  step: mockStep,
  row: mockRow,
  column_names: mockColumnNames,
  finalize: mockFinalize,
  reset: mockReset,
};

vi.mock("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs", () => ({
  default: vi.fn().mockResolvedValue({ _brand: Symbol("mock-wa-module") }),
}));
vi.mock("@journeyapps/wa-sqlite", () => ({
  Factory: vi.fn(() => mockSqlite3),
}));
vi.mock("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js", () => ({
  OPFSCoopSyncVFS: {
    create: vi.fn().mockResolvedValue({ _opfsBrand: Symbol("mock-vfs") }),
  },
}));

function singleStmtIter(ptr: number): AsyncIterable<number> {
  return {
    [Symbol.asyncIterator]() {
      let yielded = false;
      return {
        next(): Promise<IteratorResult<number>> {
          if (yielded) return Promise.resolve({ done: true as const, value: 0 });
          yielded = true;
          return Promise.resolve({ done: false as const, value: ptr });
        },
        return(): Promise<IteratorResult<number>> {
          return Promise.resolve({ done: true as const, value: 0 });
        },
      };
    },
  };
}

function multiStmtIter(ptrs: readonly number[]): AsyncIterable<number> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next(): Promise<IteratorResult<number>> {
          if (i >= ptrs.length) return Promise.resolve({ done: true as const, value: 0 });
          const value = ptrs[i++];
          if (value === undefined) return Promise.resolve({ done: true as const, value: 0 });
          return Promise.resolve({ done: false as const, value });
        },
        return(): Promise<IteratorResult<number>> {
          return Promise.resolve({ done: true as const, value: 0 });
        },
      };
    },
  };
}

interface OkEnvelope<T> {
  id: number;
  ok: true;
  result: T;
}
interface ErrEnvelope {
  id: number;
  ok: false;
  error: { message: string; name?: string };
}
type Envelope<T> = OkEnvelope<T> | ErrEnvelope;

function assertEnvelope(v: unknown): Envelope<unknown> {
  if (v === null || typeof v !== "object") {
    throw new Error(`Expected envelope object, got ${typeof v}`);
  }
  const rec: Record<string, unknown> = v as Record<string, unknown>;
  if (typeof rec.id !== "number" || typeof rec.ok !== "boolean") {
    throw new Error(`Invalid envelope: ${JSON.stringify(rec)}`);
  }
  if (rec.ok) {
    return { id: rec.id, ok: true, result: rec.result };
  }
  const errRaw = rec.error;
  if (errRaw === null || typeof errRaw !== "object") {
    throw new Error(`Invalid envelope error: ${JSON.stringify(rec)}`);
  }
  const errRec: Record<string, unknown> = errRaw as Record<string, unknown>;
  if (typeof errRec.message !== "string") {
    throw new Error(`Envelope error.message not a string: ${JSON.stringify(rec)}`);
  }
  if (errRec.name !== undefined && typeof errRec.name !== "string") {
    throw new Error(`Envelope error.name not a string: ${JSON.stringify(rec)}`);
  }
  const err: { message: string; name?: string } =
    typeof errRec.name === "string"
      ? { message: errRec.message, name: errRec.name }
      : { message: errRec.message };
  return { id: rec.id, ok: false, error: err };
}

function asNumber(v: unknown): number {
  if (typeof v !== "number") {
    throw new Error(`Expected number, got ${typeof v}: ${JSON.stringify(v)}`);
  }
  return v;
}

let fakeSelf: FakeSelf;

const ORIGINAL_SELF_KEY = "self" as const;
let originalSelf: unknown;
let originalSelfPresent = false;

beforeEach(async () => {
  originalSelfPresent = Object.prototype.hasOwnProperty.call(globalThis, ORIGINAL_SELF_KEY);
  originalSelf = originalSelfPresent ? Reflect.get(globalThis, ORIGINAL_SELF_KEY) : undefined;

  vi.clearAllMocks();
  mockOpenV2.mockResolvedValue(1);
  mockExec.mockResolvedValue(0);
  mockClose.mockResolvedValue(0);
  mockBindCollection.mockReturnValue(0);
  mockFinalize.mockResolvedValue(0);
  mockReset.mockResolvedValue(0);
  fakeSelf = installFakeSelf();
  vi.resetModules();
  await import("../opfs-worker.js");
});

afterEach(() => {
  if (originalSelfPresent) {
    Object.assign(globalThis, { [ORIGINAL_SELF_KEY]: originalSelf });
  } else {
    Reflect.deleteProperty(globalThis, ORIGINAL_SELF_KEY);
  }
});

async function dispatch(req: unknown): Promise<Envelope<unknown>> {
  const before = fakeSelf.lastPosted.length;
  const listeners = fakeSelf.listenersByType.get("message") ?? [];
  for (const l of listeners) {
    l({ data: req } satisfies Pick<MessageEvent<unknown>, "data">);
  }
  for (let i = 0; i < MAX_SETTLE_TICKS; i++) {
    if (fakeSelf.lastPosted.length > before) break;
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
  }
  const posted = fakeSelf.lastPosted[before];
  return assertEnvelope(posted);
}

describe("OPFS worker dispatch", () => {
  it("init returns { ok: true, result: undefined }", async () => {
    const res = await dispatch({ id: 1, kind: "init" });
    expect(res).toEqual({ id: 1, ok: true, result: undefined });
    expect(mockOpenV2).toHaveBeenCalledWith("pluralscape-sync.db");
    expect(mockVfsRegister).toHaveBeenCalled();
    expect(mockVfsRegister.mock.calls.length).toBeGreaterThan(0);
    const firstCall = mockVfsRegister.mock.calls[0];
    if (firstCall !== undefined) {
      expect(firstCall[1]).toBe(true);
    }
  });

  it("errors when ops come before init", async () => {
    fakeSelf = installFakeSelf();
    vi.resetModules();
    await import("../opfs-worker.js");

    const res = await dispatch({ id: 7, kind: "exec", sql: "SELECT 1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/init not called/);
    }
  });

  it("prepare returns a numeric handle", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));

    const res = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(typeof res.result).toBe("number");
    }
    expect(mockStatements).toHaveBeenCalledWith(1, "SELECT 1", { unscoped: true });
  });

  it("all returns rows assembled from step loop + column_names + row()", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT * FROM t" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    const stmtHandle = asNumber(prep.result);

    mockColumnNames.mockReturnValue(["id", "name"]);
    mockRow.mockReturnValueOnce([1, "alice"]).mockReturnValueOnce([2, "bob"]);
    mockStep.mockResolvedValueOnce(100).mockResolvedValueOnce(100).mockResolvedValueOnce(101);

    const res = await dispatch({
      id: 3,
      kind: "all",
      stmt: stmtHandle,
      params: [1],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result).toEqual([
        { id: 1, name: "alice" },
        { id: 2, name: "bob" },
      ]);
    }
  });

  it("rejects Date bind param with index + type name", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "INSERT INTO t VALUES (?)" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    const res = await dispatch({
      id: 3,
      kind: "run",
      stmt: asNumber(prep.result),
      params: [new Date()],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/unsupported bind type.*index 0.*Date/);
    }
  });

  it("txn-begin / txn-commit / txn-rollback call sqlite3.exec with BEGIN/COMMIT/ROLLBACK", async () => {
    await dispatch({ id: 1, kind: "init" });

    const begin = await dispatch({ id: 2, kind: "txn-begin" });
    expect(begin.ok).toBe(true);
    expect(mockExec).toHaveBeenCalledWith(1, "BEGIN");

    const commit = await dispatch({ id: 3, kind: "txn-commit" });
    expect(commit.ok).toBe(true);
    expect(mockExec).toHaveBeenCalledWith(1, "COMMIT");

    const rollback = await dispatch({ id: 4, kind: "txn-rollback" });
    expect(rollback.ok).toBe(true);
    expect(mockExec).toHaveBeenCalledWith(1, "ROLLBACK");
  });

  it("close nulls state and calls sqlite3.close(db)", async () => {
    await dispatch({ id: 1, kind: "init" });

    const res = await dispatch({ id: 2, kind: "close" });
    expect(res).toEqual({ id: 2, ok: true, result: undefined });
    expect(mockClose).toHaveBeenCalledWith(1);

    const afterClose = await dispatch({ id: 3, kind: "exec", sql: "SELECT 1" });
    expect(afterClose.ok).toBe(false);
    if (!afterClose.ok) {
      expect(afterClose.error.message).toMatch(/init not called/);
    }
  });

  it("finalize calls sqlite3.finalize(ptr) on the stored statement", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(4242));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    const res = await dispatch({ id: 3, kind: "finalize", stmt: asNumber(prep.result) });
    expect(res.ok).toBe(true);
    expect(mockFinalize).toHaveBeenCalledWith(4242);

    mockFinalize.mockClear();
    const res2 = await dispatch({ id: 4, kind: "finalize", stmt: asNumber(prep.result) });
    expect(res2.ok).toBe(true);
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("close finalizes still-registered statements before calling sqlite3.close", async () => {
    await dispatch({ id: 1, kind: "init" });

    mockStatements.mockReturnValueOnce(singleStmtIter(111));
    const prep1 = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1" });
    expect(prep1.ok).toBe(true);

    mockStatements.mockReturnValueOnce(singleStmtIter(222));
    const prep2 = await dispatch({ id: 3, kind: "prepare", sql: "SELECT 2" });
    expect(prep2.ok).toBe(true);

    const res = await dispatch({ id: 4, kind: "close" });
    expect(res.ok).toBe(true);

    expect(mockFinalize).toHaveBeenCalledWith(111);
    expect(mockFinalize).toHaveBeenCalledWith(222);
    expect(mockFinalize).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledWith(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("rejects multi-statement SQL and finalizes the first ptr to avoid leak", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(multiStmtIter([42, 43]));

    const res = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1; SELECT 2" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/multi-statement SQL not supported/);
    }
    expect(mockFinalize).toHaveBeenCalledWith(42);
  });

  it("rejects empty-statement SQL", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(multiStmtIter([]));

    const res = await dispatch({ id: 2, kind: "prepare", sql: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/prepare produced no statement/);
    }
  });

  it("rejects run with unknown statement handle", async () => {
    await dispatch({ id: 1, kind: "init" });

    const res = await dispatch({ id: 2, kind: "run", stmt: 999, params: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/unknown statement handle/);
    }
  });

  it("rejects run when bind_collection returns non-zero rc", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "INSERT INTO t VALUES (?)" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockBindCollection.mockReturnValue(1);

    const res = await dispatch({
      id: 3,
      kind: "run",
      stmt: asNumber(prep.result),
      params: [1],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/bind_collection failed/);
    }
  });
});
