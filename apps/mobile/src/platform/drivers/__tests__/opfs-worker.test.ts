/**
 * Unit tests for the OPFS worker dispatch logic.
 *
 * We install a fake `self` (with addEventListener/postMessage) onto globalThis
 * BEFORE importing the worker module. The worker's top-level
 * `self.addEventListener(...)` then registers against this fake so we can
 * invoke dispatch via fake message events and inspect posted responses.
 *
 * wa-sqlite + OPFSCoopSyncVFS are mocked — no WASM is loaded.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSelf {
  listeners: Array<(ev: MessageEvent<unknown>) => void>;
  lastPosted: unknown[];
  addEventListener: (type: "message", listener: (ev: MessageEvent<unknown>) => void) => void;
  postMessage: (msg: unknown) => void;
}

function installFakeSelf(): FakeSelf {
  const fake: FakeSelf = {
    listeners: [],
    lastPosted: [],
    addEventListener(_type, listener) {
      this.listeners.push(listener);
    },
    postMessage(msg) {
      this.lastPosted.push(msg);
    },
  };
  // Object.assign is type-safe: merges `{ self: FakeSelf }` onto globalThis.
  // The worker module reads `self.addEventListener` at top level; by assigning
  // before import() resolves, we ensure registration targets this fake.
  Object.assign(globalThis, { self: fake });
  return fake;
}

// Typed mocks for the SQLiteAPI surface the worker actually uses.
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

// Partial SQLiteAPI with only the methods the worker calls — Factory() returns
// this shape. We cast to SQLiteAPI via Factory's declared return (see the mock
// below), so we don't need a double-cast here.
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

/**
 * Build an AsyncIterable that yields a single statement ptr, then terminates.
 * Signature matches SQLiteAPI["statements"] so mockStatements.mockReturnValue
 * (or .mockImplementation) can accept it directly. Second arg is the SQL
 * string, third is the options object — we ignore both.
 */
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

/** Posted response shape helpers — narrow envelopes the worker returns. */
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
  const err = rec.error as { message: string; name?: string };
  return { id: rec.id, ok: false, error: err };
}

let fakeSelf: FakeSelf;

beforeEach(async () => {
  vi.clearAllMocks();
  mockOpenV2.mockResolvedValue(1);
  mockExec.mockResolvedValue(0);
  mockClose.mockResolvedValue(0);
  mockBindCollection.mockReturnValue(0); // SQLITE_OK
  mockFinalize.mockResolvedValue(0);
  fakeSelf = installFakeSelf();
  // Clear module cache so the worker's top-level `self.addEventListener`
  // runs fresh against the freshly installed fake.
  vi.resetModules();
  await import("../opfs-worker.js");
});

async function dispatch(req: unknown): Promise<Envelope<unknown>> {
  const before = fakeSelf.lastPosted.length;
  for (const l of fakeSelf.listeners) {
    l({ data: req } as MessageEvent<unknown>);
  }
  // Allow the dispatch promise chain to settle before reading posted result.
  // The worker awaits several sqlite mocks — give microtasks room to drain.
  for (let i = 0; i < 10; i++) {
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
  });

  it("errors when ops come before init", async () => {
    // Fresh install (no init called) to prove the guard fires.
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
    const stmtHandle = prep.result;
    expect(typeof stmtHandle).toBe("number");

    mockColumnNames.mockReturnValue(["id", "name"]);
    mockRow.mockReturnValueOnce([1, "alice"]).mockReturnValueOnce([2, "bob"]);
    mockStep
      .mockResolvedValueOnce(100) // SQLITE_ROW
      .mockResolvedValueOnce(100) // SQLITE_ROW
      .mockResolvedValueOnce(101); // SQLITE_DONE

    const res = await dispatch({
      id: 3,
      kind: "all",
      stmt: stmtHandle as number,
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
      stmt: prep.result as number,
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

    // After close, state is nulled — the next op should fail with init-guard.
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

    const res = await dispatch({ id: 3, kind: "finalize", stmt: prep.result as number });
    expect(res.ok).toBe(true);
    expect(mockFinalize).toHaveBeenCalledWith(4242);

    // Second finalize of the same handle is idempotent — no extra sqlite call.
    mockFinalize.mockClear();
    const res2 = await dispatch({ id: 4, kind: "finalize", stmt: prep.result as number });
    expect(res2.ok).toBe(true);
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("close finalizes still-registered statements before calling sqlite3.close", async () => {
    await dispatch({ id: 1, kind: "init" });

    // Prepare two statements — both should be finalized on close().
    mockStatements.mockReturnValueOnce(singleStmtIter(111));
    const prep1 = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1" });
    expect(prep1.ok).toBe(true);

    mockStatements.mockReturnValueOnce(singleStmtIter(222));
    const prep2 = await dispatch({ id: 3, kind: "prepare", sql: "SELECT 2" });
    expect(prep2.ok).toBe(true);

    const res = await dispatch({ id: 4, kind: "close" });
    expect(res.ok).toBe(true);

    // Both statement ptrs must be finalized, and sqlite3.close called exactly once.
    expect(mockFinalize).toHaveBeenCalledWith(111);
    expect(mockFinalize).toHaveBeenCalledWith(222);
    expect(mockFinalize).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledWith(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
