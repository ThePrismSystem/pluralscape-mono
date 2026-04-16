/// <reference lib="webworker" />
/**
 * OPFS Web Worker — hosts wa-sqlite + OPFSCoopSyncVFS so the async step()
 * loop does not block the main thread. Main-thread proxy talks to this worker
 * via the wire protocol declared in opfs-worker-protocol.ts.
 *
 * Concurrency assumption: the main-thread proxy MUST serialize transaction
 * boundaries; this worker does not mutex BEGIN/COMMIT/ROLLBACK. Statement
 * access may interleave safely at the SQLite level but nested transactions
 * are a caller bug.
 */
import { SQLITE_OK, SQLITE_ROW } from "./wa-sqlite.constants.js";

import type { BindParam, Req, Res, Row, StmtHandle } from "./opfs-worker-protocol.js";

const DB_NAME = "pluralscape-sync.db";

/** Max concurrently-tracked prepared statements before LRU eviction. */
const MAX_STMT_HANDLES = 128;

interface WorkerState {
  sqlite3: SQLiteAPI;
  db: number;
  stmts: Map<StmtHandle, { sql: string; ptr: number }>;
  nextStmtHandle: number;
}

let state: WorkerState | null = null;

/**
 * Emscripten ESM factory signature for `@journeyapps/wa-sqlite/dist/wa-sqlite.mjs`.
 * The package types `Promise<any>`; we treat the module as an opaque handle that
 * only `SQLite.Factory(waModule)` and `OPFSCoopSyncVFS.create(name, waModule)`
 * consume, so declaring the module as `unknown` is sufficient.
 */
type WaSqliteEsmFactory = (config?: object) => Promise<unknown>;

async function handleInit(): Promise<void> {
  if (state !== null) return; // idempotent
  // The package declares wa-sqlite.mjs with `export = ModuleFactory` returning
  // `Promise<any>`. Assert the factory's shape explicitly to keep
  // no-unsafe-assignment happy without `as any`/double-casts.
  const [factoryMod, SQLite, { OPFSCoopSyncVFS }] = await Promise.all([
    import("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs") as Promise<{
      default: WaSqliteEsmFactory;
    }>,
    import("@journeyapps/wa-sqlite"),
    import("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js"),
  ]);
  const SQLiteESMFactory: WaSqliteEsmFactory = factoryMod.default;
  const waModule = await SQLiteESMFactory();
  const sqlite3 = SQLite.Factory(waModule);
  const vfs = await OPFSCoopSyncVFS.create(DB_NAME, waModule);
  sqlite3.vfs_register(vfs, true);
  const db = await sqlite3.open_v2(DB_NAME);
  state = { sqlite3, db, stmts: new Map(), nextStmtHandle: 1 };
}

function requireState(): WorkerState {
  if (state === null) {
    throw new Error("OPFS worker: init not called");
  }
  return state;
}

function toBindParams(params: readonly BindParam[]): (SQLiteCompatibleType | null)[] {
  return params.map((p, i) => {
    if (p === null) return null;
    if (typeof p === "number" || typeof p === "string" || typeof p === "bigint") return p;
    if (p instanceof Uint8Array) return p;
    // Defensive: protocol restricts params to BindParam, but a malformed sender
    // could post an arbitrary value. Surface the offender with index + shape.
    const tag = Object.prototype.toString.call(p);
    const desc = typeof p === "object" ? tag.slice(8, -1) : typeof p;
    throw new Error(`OPFS worker: unsupported bind type at index ${String(i)}: ${desc}`);
  });
}

function recordsFromStmt(s: WorkerState, ptr: number): Row {
  const cols = s.sqlite3.column_names(ptr);
  const vals = s.sqlite3.row(ptr);
  const obj: Row = Object.create(null) as Row;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (col === undefined) continue;
    const v = vals[i];
    if (v === undefined || v === null) {
      obj[col] = null;
      continue;
    }
    if (Array.isArray(v)) {
      // wa-sqlite's row() may return number[] for BLOB columns in some builds;
      // convert to Uint8Array so it matches the protocol's BindParam shape.
      obj[col] = Uint8Array.from(v);
      continue;
    }
    obj[col] = v;
  }
  return obj;
}

async function stepAll(s: WorkerState, ptr: number): Promise<Row[]> {
  const rows: Row[] = [];
  while ((await s.sqlite3.step(ptr)) === SQLITE_ROW) {
    rows.push(recordsFromStmt(s, ptr));
  }
  return rows;
}

async function handlePrepare(sql: string): Promise<StmtHandle> {
  const s = requireState();
  // Compile via statements() with `unscoped: true` so the returned ptr stays
  // valid outside the iterator. Adapters always send single statements — if we
  // encounter multi, finalize the first and throw rather than silently drop.
  const iter = s.sqlite3.statements(s.db, sql, { unscoped: true })[Symbol.asyncIterator]();
  let first: IteratorResult<number>;
  try {
    first = await iter.next();
  } catch (err) {
    await iter.return?.(undefined);
    throw err;
  }
  if (first.done === true) {
    throw new Error(`OPFS worker: prepare produced no statement for SQL: ${sql}`);
  }
  const ptr = first.value;
  let second: IteratorResult<number>;
  try {
    second = await iter.next();
  } catch (err) {
    await s.sqlite3.finalize(ptr);
    throw err;
  }
  if (second.done !== true) {
    await iter.return?.(undefined);
    await s.sqlite3.finalize(ptr);
    throw new Error(`OPFS worker: prepare of multi-statement SQL not supported: ${sql}`);
  }
  const handle = s.nextStmtHandle++;
  s.stmts.set(handle, { sql, ptr });
  if (s.stmts.size > MAX_STMT_HANDLES) {
    // LRU: evict oldest entry and free its sqlite statement (Map preserves
    // insertion order). Without this finalize, evicted ptrs would leak until
    // close().
    const [oldest] = s.stmts.keys();
    if (oldest !== undefined && oldest !== handle) {
      const evicted = s.stmts.get(oldest);
      s.stmts.delete(oldest);
      if (evicted !== undefined) await s.sqlite3.finalize(evicted.ptr);
    }
  }
  return handle;
}

async function handleExec(sql: string): Promise<void> {
  const s = requireState();
  await s.sqlite3.exec(s.db, sql);
}

function bindAndReset(s: WorkerState, handle: StmtHandle, params: readonly BindParam[]): number {
  const entry = s.stmts.get(handle);
  if (entry === undefined) {
    throw new Error(`OPFS worker: unknown statement handle ${String(handle)}`);
  }
  const bindParams = toBindParams(params);
  const rc = s.sqlite3.bind_collection(entry.ptr, bindParams);
  if (rc !== SQLITE_OK) {
    throw new Error(`OPFS worker: bind_collection failed (rc=${String(rc)})`);
  }
  return entry.ptr;
}

async function handleRun(handle: StmtHandle, params: readonly BindParam[]): Promise<void> {
  const s = requireState();
  const ptr = bindAndReset(s, handle, params);
  // Drain step() until DONE.
  while ((await s.sqlite3.step(ptr)) === SQLITE_ROW) {
    /* drain */
  }
}

async function handleAll(handle: StmtHandle, params: readonly BindParam[]): Promise<Row[]> {
  const s = requireState();
  const ptr = bindAndReset(s, handle, params);
  return stepAll(s, ptr);
}

async function handleGet(
  handle: StmtHandle,
  params: readonly BindParam[],
): Promise<Row | undefined> {
  const s = requireState();
  const ptr = bindAndReset(s, handle, params);
  const rc = await s.sqlite3.step(ptr);
  if (rc === SQLITE_ROW) {
    return recordsFromStmt(s, ptr);
  }
  return undefined;
}

async function handleFinalize(handle: StmtHandle): Promise<void> {
  const s = requireState();
  const entry = s.stmts.get(handle);
  if (entry === undefined) return; // idempotent
  s.stmts.delete(handle);
  await s.sqlite3.finalize(entry.ptr);
}

async function handleClose(): Promise<void> {
  const s = state;
  if (s === null) return;
  // Finalize any still-registered statements before closing. sqlite3_close_v2
  // will also clean up, but explicit finalize keeps the registry and SQLite
  // state consistent for diagnostics.
  for (const entry of s.stmts.values()) {
    await s.sqlite3.finalize(entry.ptr);
  }
  s.stmts.clear();
  await s.sqlite3.close(s.db);
  state = null;
}

async function dispatch(req: Req): Promise<Res> {
  try {
    switch (req.kind) {
      case "init":
        await handleInit();
        return { id: req.id, ok: true, result: undefined };
      case "prepare":
        return { id: req.id, ok: true, result: await handlePrepare(req.sql) };
      case "exec":
        await handleExec(req.sql);
        return { id: req.id, ok: true, result: undefined };
      case "run":
        await handleRun(req.stmt, req.params);
        return { id: req.id, ok: true, result: undefined };
      case "all":
        return { id: req.id, ok: true, result: await handleAll(req.stmt, req.params) };
      case "get":
        return { id: req.id, ok: true, result: await handleGet(req.stmt, req.params) };
      case "txn-begin":
        await handleExec("BEGIN");
        return { id: req.id, ok: true, result: undefined };
      case "txn-commit":
        await handleExec("COMMIT");
        return { id: req.id, ok: true, result: undefined };
      case "txn-rollback":
        await handleExec("ROLLBACK");
        return { id: req.id, ok: true, result: undefined };
      case "finalize":
        await handleFinalize(req.stmt);
        return { id: req.id, ok: true, result: undefined };
      case "close":
        await handleClose();
        return { id: req.id, ok: true, result: undefined };
      default: {
        const _exhaustive: never = req;
        throw new Error(`OPFS worker: unknown request kind: ${JSON.stringify(_exhaustive)}`);
      }
    }
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    return {
      id: req.id,
      ok: false,
      error: { message: e.message, name: e.name },
    };
  }
}

self.addEventListener("message", (ev: MessageEvent<Req>) => {
  void dispatch(ev.data).then((res) => {
    try {
      self.postMessage(res);
    } catch (err: unknown) {
      // postMessage throws if a result value is not structured-cloneable. Fall
      // back to an error envelope so the caller's pending slot still resolves.
      const e = err instanceof Error ? err : new Error(String(err));
      self.postMessage({
        id: res.id,
        ok: false,
        error: { message: `OPFS worker: failed to post response: ${e.message}`, name: e.name },
      });
    }
  });
});
