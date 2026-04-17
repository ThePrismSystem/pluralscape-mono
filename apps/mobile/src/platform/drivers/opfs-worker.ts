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
import { MAX_STMT_HANDLES, SQLITE_OK, SQLITE_ROW } from "./wa-sqlite.constants.js";

import type { BindParam, Req, Res, Row, StmtHandle } from "./opfs-worker-protocol.js";

const DB_NAME = "pluralscape-sync.db";

/** Length of the "txn-" prefix on txn-begin/commit/rollback request kinds. */
const TXN_PREFIX_LEN = 4;

interface WorkerState {
  sqlite3: SQLiteAPI;
  db: number;
  stmts: Map<StmtHandle, { sql: string; ptr: number }>;
  sqlIndex: Map<string, StmtHandle>;
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
  if (state !== null) return;
  // Emscripten ESM default export is typed Promise<any>.
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
  state = { sqlite3, db, stmts: new Map(), sqlIndex: new Map(), nextStmtHandle: 1 };
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
  // True LRU: if SQL is already cached, bump its recency by re-inserting into
  // the Map (insertion order == recency) and return the existing handle.
  const existing = s.sqlIndex.get(sql);
  if (existing !== undefined) {
    const entry = s.stmts.get(existing);
    if (entry !== undefined) {
      s.stmts.delete(existing);
      s.stmts.set(existing, entry);
      return existing;
    }
    // Stale index — fall through to fresh prepare and overwrite.
    s.sqlIndex.delete(sql);
  }
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
  s.sqlIndex.set(sql, handle);
  if (s.stmts.size > MAX_STMT_HANDLES) {
    // LRU: evict oldest entry and free its sqlite statement (Map preserves
    // insertion order). Without this finalize, evicted ptrs would leak until
    // close().
    const [oldest] = s.stmts.keys();
    if (oldest !== undefined && oldest !== handle) {
      const evicted = s.stmts.get(oldest);
      s.stmts.delete(oldest);
      if (evicted !== undefined) {
        s.sqlIndex.delete(evicted.sql);
        await s.sqlite3.finalize(evicted.ptr);
      }
    }
  }
  return handle;
}

async function handleExec(sql: string): Promise<void> {
  const s = requireState();
  await s.sqlite3.exec(s.db, sql);
}

async function bindAndReset(
  s: WorkerState,
  handle: StmtHandle,
  params: readonly BindParam[],
): Promise<number> {
  const entry = s.stmts.get(handle);
  if (entry === undefined) {
    throw new Error(`OPFS worker: unknown statement handle ${String(handle)}`);
  }
  await s.sqlite3.reset(entry.ptr);
  const bindParams = toBindParams(params);
  const rc = s.sqlite3.bind_collection(entry.ptr, bindParams);
  if (rc !== SQLITE_OK) {
    throw new Error(`OPFS worker: bind_collection failed (rc=${String(rc)})`);
  }
  return entry.ptr;
}

async function handleRun(handle: StmtHandle, params: readonly BindParam[]): Promise<void> {
  const s = requireState();
  const ptr = await bindAndReset(s, handle, params);
  await stepAll(s, ptr);
}

async function handleAll(handle: StmtHandle, params: readonly BindParam[]): Promise<Row[]> {
  const s = requireState();
  const ptr = await bindAndReset(s, handle, params);
  return stepAll(s, ptr);
}

async function handleGet(
  handle: StmtHandle,
  params: readonly BindParam[],
): Promise<Row | undefined> {
  const s = requireState();
  const ptr = await bindAndReset(s, handle, params);
  const rc = await s.sqlite3.step(ptr);
  if (rc === SQLITE_ROW) {
    return recordsFromStmt(s, ptr);
  }
  return undefined;
}

async function handleFinalize(handle: StmtHandle): Promise<void> {
  const s = requireState();
  const entry = s.stmts.get(handle);
  if (entry === undefined) return;
  s.stmts.delete(handle);
  s.sqlIndex.delete(entry.sql);
  await s.sqlite3.finalize(entry.ptr);
}

async function handleClose(): Promise<void> {
  const s = state;
  if (s === null) return;
  try {
    // Finalize any still-registered statements concurrently. allSettled so a
    // single failing finalize cannot orphan the remaining handles or block the
    // sqlite3_close call below.
    const finalizes = [...s.stmts.values()].map((entry) => s.sqlite3.finalize(entry.ptr));
    await Promise.allSettled(finalizes);
    s.stmts.clear();
    s.sqlIndex.clear();
    await s.sqlite3.close(s.db).catch((err: unknown) => {
      // Surface close failures via the panic channel — swallowing would
      // strand the main-thread proxy.
      const msg = err instanceof Error ? err.message : String(err);
      postPanic("sqlite3_close", msg);
    });
  } finally {
    // Null state even if the try block throws so re-init can proceed.
    state = null;
  }
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
      case "txn-commit":
      case "txn-rollback": {
        // req.kind is "txn-<verb>" — slice off "txn-" and uppercase to get the
        // matching SQL keyword (BEGIN/COMMIT/ROLLBACK).
        const sql = req.kind.slice(TXN_PREFIX_LEN).toUpperCase();
        await handleExec(sql);
        return { id: req.id, ok: true, result: undefined };
      }
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
    // wa-sqlite errors carry a numeric `code` matching SQLite's rescode.h.
    // Propagate numeric code so callers can branch on SQLite result codes
    // without string-matching message text.
    const code =
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof (err as { code: unknown }).code === "number"
        ? (err as { code: number }).code
        : undefined;
    return {
      id: req.id,
      ok: false,
      error:
        code !== undefined
          ? { message: e.message, name: e.name, code }
          : { message: e.message, name: e.name },
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

function reasonToMessage(reason: unknown): string {
  const resolved = resolveReason(reason);
  // Empty strings (raw "", Error("") , etc.) would yield an empty `message`
  // field on the panic envelope — swap in a non-empty default so main-thread
  // consumers can always rely on a diagnostic string.
  return resolved === "" ? "(empty reason)" : resolved;
}

function resolveReason(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (reason === null || reason === undefined) {
    return "(no reason)";
  }
  if (typeof reason === "string") {
    return reason;
  }
  if (typeof reason === "number" || typeof reason === "bigint" || typeof reason === "boolean") {
    return String(reason);
  }
  // Objects without a useful toString — JSON-stringify defensively so we don't
  // surface "[object Object]" to the main thread.
  try {
    return JSON.stringify(reason);
  } catch {
    return "(unserialisable reason)";
  }
}

/**
 * Post an out-of-band panic envelope (id === -1) so a main-thread driver that
 * already lost the correlation id of the triggering request still has a signal
 * it can surface as worker death. Failures of postMessage itself are swallowed
 * — the worker is in a bad state already and we have no other channel.
 */
function postPanic(name: string, message: string): void {
  try {
    self.postMessage({
      id: -1,
      ok: false,
      panic: true,
      error: { name, message },
    });
  } catch {
    // postMessage may throw if the worker is in shutdown; nothing we can do.
  }
}

self.addEventListener("error", (ev: ErrorEvent) => {
  postPanic("error", ev.message !== "" ? ev.message : "uncaught worker error");
});

self.addEventListener("messageerror", (ev: MessageEvent) => {
  postPanic("messageerror", reasonToMessage(ev.data));
});

self.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
  postPanic("unhandledrejection", reasonToMessage(ev.reason));
});
