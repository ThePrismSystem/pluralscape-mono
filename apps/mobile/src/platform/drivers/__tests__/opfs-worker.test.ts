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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Upper bound on setTimeout(0) ticks allowed while waiting for the worker's
 * dispatch chain to settle. Some ops await multiple async sqlite calls
 * (e.g. prepare does two iter.next() calls before resolving), so a single
 * microtask flush is insufficient — we poll up to this many macrotasks.
 */
const MAX_SETTLE_TICKS = 10;

/**
 * Event types the worker module subscribes to on `self`. `message` drives the
 * request dispatch path; `error`/`messageerror`/`unhandledrejection` drive the
 * panic envelope path added as part of this commit.
 */
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
const mockReset = vi.fn<SQLiteAPI["reset"]>();

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

/**
 * Build an AsyncIterable that yields the given ptrs in order. Used to simulate
 * multi-statement SQL (two+ ptrs) and empty-statement SQL (zero ptrs).
 */
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
  // Runtime-narrow the error field rather than casting — a malformed worker
  // payload should fail this helper, not silently propagate as `any`-shaped.
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

/** Narrow an `unknown` to `number`, throwing with context if it is not. */
function asNumber(v: unknown): number {
  if (typeof v !== "number") {
    throw new Error(`Expected number, got ${typeof v}: ${JSON.stringify(v)}`);
  }
  return v;
}

let fakeSelf: FakeSelf;

/**
 * Store the original `self` value from globalThis (if any) so we can restore
 * it after each test. Vitest workers run in a Node-ish environment where
 * `self` is typically undefined, but we don't want to assume — save whatever
 * was there and put it back.
 */
const ORIGINAL_SELF_KEY = "self" as const;
let originalSelf: unknown;
let originalSelfPresent = false;

beforeEach(async () => {
  // Reflect.get + hasOwnProperty avoids a cast on globalThis — we still get
  // the (unknown) original value if it was defined.
  originalSelfPresent = Object.prototype.hasOwnProperty.call(globalThis, ORIGINAL_SELF_KEY);
  originalSelf = originalSelfPresent ? Reflect.get(globalThis, ORIGINAL_SELF_KEY) : undefined;

  vi.clearAllMocks();
  mockOpenV2.mockResolvedValue(1);
  mockExec.mockResolvedValue(0);
  mockClose.mockResolvedValue(0);
  mockBindCollection.mockReturnValue(0); // SQLITE_OK
  mockFinalize.mockResolvedValue(0);
  mockReset.mockResolvedValue(0);
  fakeSelf = installFakeSelf();
  // Clear module cache so the worker's top-level `self.addEventListener`
  // runs fresh against the freshly installed fake.
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
    // The worker registers its message handler typed as MessageEvent<Req>, but
    // our FakeSelf stores listeners as `(ev: unknown) => void` so every event
    // type shares one map. The runtime payload we hand it is structurally a
    // MessageEvent<unknown>: the listener only reads `ev.data`, so a single
    // structural step satisfies both sides without a double-cast.
    l({ data: req } satisfies Pick<MessageEvent<unknown>, "data">);
  }
  // Allow the dispatch promise chain to settle before reading posted result.
  // The worker awaits several sqlite mocks — give macrotasks room to drain.
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
    // vfs_register must be called with makeDefault === true so opens without
    // an explicit vfs name route through OPFSCoopSyncVFS.
    expect(mockVfsRegister.mock.calls.length).toBeGreaterThan(0);
    const firstCall = mockVfsRegister.mock.calls[0];
    if (firstCall !== undefined) {
      expect(firstCall[1]).toBe(true);
    }
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
    const stmtHandle = asNumber(prep.result);

    mockColumnNames.mockReturnValue(["id", "name"]);
    mockRow.mockReturnValueOnce([1, "alice"]).mockReturnValueOnce([2, "bob"]);
    mockStep
      .mockResolvedValueOnce(100) // SQLITE_ROW
      .mockResolvedValueOnce(100) // SQLITE_ROW
      .mockResolvedValueOnce(101); // SQLITE_DONE

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

    const res = await dispatch({ id: 3, kind: "finalize", stmt: asNumber(prep.result) });
    expect(res.ok).toBe(true);
    expect(mockFinalize).toHaveBeenCalledWith(4242);

    // Second finalize of the same handle is idempotent — no extra sqlite call.
    mockFinalize.mockClear();
    const res2 = await dispatch({ id: 4, kind: "finalize", stmt: asNumber(prep.result) });
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

  it("rejects multi-statement SQL and finalizes the first ptr to avoid leak", async () => {
    await dispatch({ id: 1, kind: "init" });
    // Two ptrs yielded — simulates multi-statement SQL like "SELECT 1; SELECT 2".
    mockStatements.mockReturnValue(multiStmtIter([42, 43]));

    const res = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1; SELECT 2" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/multi-statement SQL not supported/);
    }
    // The first ptr must be finalized (iterator-cleanup path); the second
    // ptr is never materialized as a handle so no finalize call for it.
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

    mockBindCollection.mockReturnValue(1); // non-OK rc

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

  it("get returns the first row when step yields SQLITE_ROW", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT * FROM t LIMIT 1" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockColumnNames.mockReturnValue(["id", "name"]);
    mockRow.mockReturnValueOnce([7, "carol"]);
    mockStep.mockResolvedValueOnce(100); // SQLITE_ROW

    const res = await dispatch({
      id: 3,
      kind: "get",
      stmt: asNumber(prep.result),
      params: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result).toEqual({ id: 7, name: "carol" });
    }
  });

  it("get returns undefined when step yields SQLITE_DONE (no row)", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT * FROM t WHERE 0" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockStep.mockResolvedValueOnce(101); // SQLITE_DONE

    const res = await dispatch({
      id: 3,
      kind: "get",
      stmt: asNumber(prep.result),
      params: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result).toBeUndefined();
    }
  });

  it("evicts oldest statement via LRU once MAX_STMT_HANDLES is exceeded", async () => {
    await dispatch({ id: 1, kind: "init" });

    // Prepare MAX_STMT_HANDLES + 1 = 129 statements. Each returns a unique ptr
    // (1000, 1001, ..., 1128). The 129th insert triggers LRU eviction of the
    // first (ptr=1000), which must be finalized.
    const MAX_STMT_HANDLES = 128;
    const totalToPrepare = MAX_STMT_HANDLES + 1;
    for (let i = 0; i < totalToPrepare; i++) {
      mockStatements.mockReturnValueOnce(singleStmtIter(1000 + i));
      const prep = await dispatch({ id: 100 + i, kind: "prepare", sql: `SELECT ${String(i)}` });
      expect(prep.ok).toBe(true);
    }

    // The first ptr (1000) should have been finalized when the 129th was added.
    expect(mockFinalize).toHaveBeenCalledWith(1000);
  });

  it("coerces number[] column values (BLOB) to Uint8Array", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT data FROM blobs" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockColumnNames.mockReturnValue(["data"]);
    // wa-sqlite returns BLOB columns as number[] in some builds. The worker's
    // recordsFromStmt() Array.isArray branch must convert to Uint8Array so the
    // response matches the BindParam shape.
    mockRow.mockReturnValueOnce([[1, 2, 3]]);
    mockStep.mockResolvedValueOnce(100).mockResolvedValueOnce(101); // ROW, DONE

    const res = await dispatch({
      id: 3,
      kind: "all",
      stmt: asNumber(prep.result),
      params: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const rows = res.result;
      expect(Array.isArray(rows)).toBe(true);
      if (Array.isArray(rows)) {
        expect(rows).toHaveLength(1);
        const first = rows[0];
        if (first !== undefined && typeof first === "object" && first !== null) {
          const rec: Record<string, unknown> = first as Record<string, unknown>;
          const data = rec.data;
          expect(data).toBeInstanceOf(Uint8Array);
          if (data instanceof Uint8Array) {
            expect(Array.from(data)).toEqual([1, 2, 3]);
          }
        }
      }
    }
  });

  it("falls back to error envelope when postMessage throws on first response", async () => {
    // Swap postMessage so the first call throws (simulating a non-cloneable
    // result) but the second call (the error fallback) succeeds.
    const originalPost = fakeSelf.postMessage.bind(fakeSelf);
    let calls = 0;
    const thrownMessages: unknown[] = [];
    fakeSelf.postMessage = (msg: unknown): void => {
      calls++;
      if (calls === 1) {
        thrownMessages.push(msg);
        throw new Error("structured clone failed");
      }
      originalPost(msg);
    };

    try {
      // The raw dispatch path: trigger listener, then wait for the fallback
      // envelope to land in lastPosted. We can't use the top-level `dispatch`
      // helper because the first postMessage throws (lastPosted length won't
      // advance on call #1), so we poll for lastPosted > initial.
      const before = fakeSelf.lastPosted.length;
      const listeners = fakeSelf.listenersByType.get("message") ?? [];
      for (const l of listeners) {
        l({ data: { id: 99, kind: "init" } } satisfies Pick<MessageEvent<unknown>, "data">);
      }
      for (let i = 0; i < MAX_SETTLE_TICKS; i++) {
        if (fakeSelf.lastPosted.length > before) break;
        await new Promise<void>((r) => {
          setTimeout(r, 0);
        });
      }
      const posted = fakeSelf.lastPosted[before];
      const env = assertEnvelope(posted);
      expect(env.ok).toBe(false);
      if (!env.ok) {
        expect(env.error.message).toMatch(/failed to post response/);
      }
      // The first (thrown) call was given the original success envelope.
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      fakeSelf.postMessage = originalPost;
    }
  });

  it("rejects unknown request kind via default/exhaustive switch arm", async () => {
    await dispatch({ id: 1, kind: "init" });

    // The worker's dispatch uses a `never`-typed default arm — send a request
    // whose kind is not in the Req union. Route via the FakeSelf path directly
    // since our top-level dispatch helper is untyped (accepts `unknown`).
    const res = await dispatch({ id: 42, kind: "bogus" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/unknown request kind/);
    }
  });

  it("bindAndReset calls sqlite3.reset before bind_collection so cached statements re-bind cleanly", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "INSERT INTO t VALUES (?)" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    const handle = asNumber(prep.result);

    // First run drains to DONE.
    mockStep.mockResolvedValueOnce(101); // SQLITE_DONE
    await dispatch({ id: 3, kind: "run", stmt: handle, params: [] });

    // Second run: assert reset was called, and called before bind_collection.
    mockReset.mockClear();
    mockBindCollection.mockClear();
    mockStep.mockResolvedValueOnce(101); // SQLITE_DONE
    await dispatch({ id: 4, kind: "run", stmt: handle, params: [42] });

    expect(mockReset).toHaveBeenCalledWith(42);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockBindCollection).toHaveBeenCalledTimes(1);
    // Invocation-order check: reset's single call precedes bind_collection's.
    const resetOrder = mockReset.mock.invocationCallOrder[0];
    const bindOrder = mockBindCollection.mock.invocationCallOrder[0];
    // Both mocks asserted as called above, so invocationCallOrder entries exist.
    expect(typeof resetOrder).toBe("number");
    expect(typeof bindOrder).toBe("number");
    if (resetOrder !== undefined && bindOrder !== undefined) {
      expect(resetOrder).toBeLessThan(bindOrder);
    }
  });

  it("handleClose continues past a failing finalize and still closes + nulls state", async () => {
    await dispatch({ id: 1, kind: "init" });

    mockStatements.mockReturnValueOnce(singleStmtIter(111));
    const prep1 = await dispatch({ id: 2, kind: "prepare", sql: "SELECT 1" });
    expect(prep1.ok).toBe(true);
    mockStatements.mockReturnValueOnce(singleStmtIter(222));
    const prep2 = await dispatch({ id: 3, kind: "prepare", sql: "SELECT 2" });
    expect(prep2.ok).toBe(true);

    // Make the FIRST finalize reject; the second + sqlite3.close must still run.
    mockFinalize.mockReset();
    mockFinalize.mockRejectedValueOnce(new Error("finalize boom")).mockResolvedValueOnce(0);

    const closeRes = await dispatch({ id: 4, kind: "close" });
    expect(closeRes.ok).toBe(true);
    expect(mockFinalize).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledWith(1);
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Re-init must succeed — state was nulled in finally.
    const reInit = await dispatch({ id: 5, kind: "init" });
    expect(reInit.ok).toBe(true);
  });

  it("propagates numeric error.code from wa-sqlite errors through the envelope", async () => {
    await dispatch({ id: 1, kind: "init" });

    // Simulate a SQLITE_FULL-style error: numeric `code` + named subclass.
    const SQLITE_FULL = 13;
    const err: Error & { code: number } = Object.assign(new Error("disk full"), {
      code: SQLITE_FULL,
      name: "SQLiteError",
    });
    mockExec.mockRejectedValueOnce(err);

    const res = await dispatch({ id: 2, kind: "exec", sql: "INSERT INTO t VALUES (1)" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.name).toBe("SQLiteError");
    expect(res.error.message).toBe("disk full");

    // The typed envelope helper drops `code` — re-read the last posted message
    // directly and runtime-narrow to assert the numeric code propagated.
    const rawPosted = fakeSelf.lastPosted[fakeSelf.lastPosted.length - 1];
    if (rawPosted === null || typeof rawPosted !== "object") {
      throw new Error("posted envelope missing");
    }
    const rawRec: Record<string, unknown> = rawPosted as Record<string, unknown>;
    const rawErr = rawRec.error;
    if (rawErr === null || typeof rawErr !== "object") {
      throw new Error("posted error field missing");
    }
    const rawErrRec: Record<string, unknown> = rawErr as Record<string, unknown>;
    expect(rawErrRec.code).toBe(SQLITE_FULL);
  });

  it("true-LRU: touching a cached SQL bumps its recency so it survives eviction", async () => {
    await dispatch({ id: 1, kind: "init" });

    const MAX = 128;
    // Fill the cache to MAX. ptr_i = 1000 + i so evicted ptrs are identifiable.
    for (let i = 0; i < MAX; i++) {
      mockStatements.mockReturnValueOnce(singleStmtIter(1000 + i));
      const prep = await dispatch({ id: 100 + i, kind: "prepare", sql: `SELECT ${String(i)}` });
      expect(prep.ok).toBe(true);
    }

    // Re-prepare "SELECT 0" — this must hit the sqlIndex cache, return the
    // same handle, and bump recency to MRU WITHOUT calling statements() again.
    mockStatements.mockClear();
    const bump = await dispatch({ id: 300, kind: "prepare", sql: "SELECT 0" });
    expect(bump.ok).toBe(true);
    expect(mockStatements).not.toHaveBeenCalled();

    // Add one fresh statement — eviction should drop "SELECT 1" (now the
    // oldest in insertion order), NOT "SELECT 0" (which was just bumped).
    mockFinalize.mockClear();
    mockStatements.mockReturnValueOnce(singleStmtIter(2000));
    const fresh = await dispatch({ id: 400, kind: "prepare", sql: "SELECT NEW" });
    expect(fresh.ok).toBe(true);

    // Exactly one finalize, and it must be for ptr=1001 ("SELECT 1"), not 1000.
    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockFinalize).toHaveBeenCalledWith(1001);
    expect(mockFinalize).not.toHaveBeenCalledWith(1000);
  });
});

/**
 * Global error/messageerror/unhandledrejection listeners that post panic
 * envelopes (id=-1) so the main-thread proxy can surface silent worker death.
 * These exercise the out-of-band channel, not the dispatch path — we invoke
 * each typed listener directly through the FakeSelf's listenersByType map.
 */
describe("opfs-worker — global panic listeners", () => {
  it("posts a panic envelope when a 'messageerror' event fires", () => {
    const listeners = fakeSelf.listenersByType.get("messageerror") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("messageerror listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ data: "non-cloneable" });
    expect(fakeSelf.lastPosted).toHaveLength(before + 1);
    const posted = fakeSelf.lastPosted[before];
    // Lock down BOTH fields — the listener routes through reasonToMessage so
    // the panic envelope's message should equal the original ev.data string.
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "messageerror", message: "non-cloneable" },
    });
  });

  it("posts a panic envelope with '(empty reason)' when messageerror data is empty", () => {
    const listeners = fakeSelf.listenersByType.get("messageerror") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("messageerror listener not registered");
    const before = fakeSelf.lastPosted.length;
    // reasonToMessage coerces empty strings to "(empty reason)" so consumers
    // always receive a non-empty diagnostic.
    fn({ data: "" });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "messageerror", message: "(empty reason)" },
    });
  });

  it("posts a panic envelope on global 'error' event", () => {
    const listeners = fakeSelf.listenersByType.get("error") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("error listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ message: "uncaught: boom" });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "error" },
    });
    // Narrow the posted envelope so we can assert message content without a
    // double-cast.
    if (posted === null || typeof posted !== "object") throw new Error("bad posted");
    const rec: Record<string, unknown> = posted as Record<string, unknown>;
    const errField = rec.error;
    if (errField === null || typeof errField !== "object") throw new Error("bad error");
    const errRec: Record<string, unknown> = errField as Record<string, unknown>;
    expect(errRec.message).toMatch(/boom/);
  });

  it("posts a panic envelope on 'unhandledrejection' with Error reason", () => {
    const listeners = fakeSelf.listenersByType.get("unhandledrejection") ?? [];
    const fn = listeners[0];
    if (fn === undefined) throw new Error("unhandledrejection listener not registered");
    const before = fakeSelf.lastPosted.length;
    fn({ reason: new Error("late reject") });
    const posted = fakeSelf.lastPosted[before];
    expect(posted).toMatchObject({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "unhandledrejection" },
    });
    if (posted === null || typeof posted !== "object") throw new Error("bad posted");
    const rec: Record<string, unknown> = posted as Record<string, unknown>;
    const errField = rec.error;
    if (errField === null || typeof errField !== "object") throw new Error("bad error");
    const errRec: Record<string, unknown> = errField as Record<string, unknown>;
    expect(errRec.message).toMatch(/late reject/);
  });
});
