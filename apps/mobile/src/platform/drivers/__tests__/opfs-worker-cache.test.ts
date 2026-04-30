/**
 * OPFS worker dispatch tests — statement cache, LRU eviction, BLOB coercion,
 * error envelopes, exhaustive switch guard, error propagation.
 *
 * Companion files: opfs-worker-dispatch.test.ts, opfs-worker-panic.test.ts
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

describe("OPFS worker cache + error handling", () => {
  it("get returns the first row when step yields SQLITE_ROW", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT * FROM t LIMIT 1" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockColumnNames.mockReturnValue(["id", "name"]);
    mockRow.mockReturnValueOnce([7, "carol"]);
    mockStep.mockResolvedValueOnce(100);

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

    mockStep.mockResolvedValueOnce(101);

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

    const MAX_STMT_HANDLES = 128;
    const totalToPrepare = MAX_STMT_HANDLES + 1;
    for (let i = 0; i < totalToPrepare; i++) {
      mockStatements.mockReturnValueOnce(singleStmtIter(1000 + i));
      const prep = await dispatch({ id: 100 + i, kind: "prepare", sql: `SELECT ${String(i)}` });
      expect(prep.ok).toBe(true);
    }

    expect(mockFinalize).toHaveBeenCalledWith(1000);
  });

  it("coerces number[] column values (BLOB) to Uint8Array", async () => {
    await dispatch({ id: 1, kind: "init" });
    mockStatements.mockReturnValue(singleStmtIter(42));
    const prep = await dispatch({ id: 2, kind: "prepare", sql: "SELECT data FROM blobs" });
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;

    mockColumnNames.mockReturnValue(["data"]);
    mockRow.mockReturnValueOnce([[1, 2, 3]]);
    mockStep.mockResolvedValueOnce(100).mockResolvedValueOnce(101);

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
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      fakeSelf.postMessage = originalPost;
    }
  });

  it("rejects unknown request kind via default/exhaustive switch arm", async () => {
    await dispatch({ id: 1, kind: "init" });

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

    mockStep.mockResolvedValueOnce(101);
    await dispatch({ id: 3, kind: "run", stmt: handle, params: [] });

    mockReset.mockClear();
    mockBindCollection.mockClear();
    mockStep.mockResolvedValueOnce(101);
    await dispatch({ id: 4, kind: "run", stmt: handle, params: [42] });

    expect(mockReset).toHaveBeenCalledWith(42);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockBindCollection).toHaveBeenCalledTimes(1);
    const resetOrder = mockReset.mock.invocationCallOrder[0];
    const bindOrder = mockBindCollection.mock.invocationCallOrder[0];
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

    mockFinalize.mockReset();
    mockFinalize.mockRejectedValueOnce(new Error("finalize boom")).mockResolvedValueOnce(0);

    const closeRes = await dispatch({ id: 4, kind: "close" });
    expect(closeRes.ok).toBe(true);
    expect(mockFinalize).toHaveBeenCalledTimes(2);
    expect(mockClose).toHaveBeenCalledWith(1);
    expect(mockClose).toHaveBeenCalledTimes(1);

    const reInit = await dispatch({ id: 5, kind: "init" });
    expect(reInit.ok).toBe(true);
  });

  it("propagates numeric error.code from wa-sqlite errors through the envelope", async () => {
    await dispatch({ id: 1, kind: "init" });

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
    for (let i = 0; i < MAX; i++) {
      mockStatements.mockReturnValueOnce(singleStmtIter(1000 + i));
      const prep = await dispatch({ id: 100 + i, kind: "prepare", sql: `SELECT ${String(i)}` });
      expect(prep.ok).toBe(true);
    }

    mockStatements.mockClear();
    const bump = await dispatch({ id: 300, kind: "prepare", sql: "SELECT 0" });
    expect(bump.ok).toBe(true);
    expect(mockStatements).not.toHaveBeenCalled();

    mockFinalize.mockClear();
    mockStatements.mockReturnValueOnce(singleStmtIter(2000));
    const fresh = await dispatch({ id: 400, kind: "prepare", sql: "SELECT NEW" });
    expect(fresh.ok).toBe(true);

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    expect(mockFinalize).toHaveBeenCalledWith(1001);
    expect(mockFinalize).not.toHaveBeenCalledWith(1000);
  });
});
