import {
  OpfsDriverError,
  OpfsDriverUnavailableError,
  WorkerTerminatedError,
} from "./opfs-worker-protocol.js";

import type { BindParam, Req, Res, Row, StmtHandle } from "./opfs-worker-protocol.js";
import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

/** Worker init must complete within this window or the driver is considered unavailable. */
const INIT_TIMEOUT_MS = 5_000;

/**
 * Distributive Omit: applied to a discriminated union, produces a union of
 * per-member Omits. The built-in Omit is non-distributive and collapses the
 * variants to their shared keys, which erases our protocol's discriminants.
 *
 * The `T extends Req` wrapper forces TS to distribute across the union
 * before applying `Omit`, so each variant retains its own `kind` + payload.
 */
type ReqWithoutId<T extends Req = Req> = T extends Req ? Omit<T, "id"> : never;

/**
 * wa-sqlite over OPFS, hosted in a dedicated Web Worker.
 *
 * Main thread is a thin proxy: each driver call serializes a typed request,
 * posts it to the worker, and resolves with the response. No SharedArrayBuffer,
 * no Atomics, no cross-origin isolation required.
 *
 * Tree-shaken from native bundles via the dynamic import in detect.ts.
 */
export async function createOpfsSqliteDriver(): Promise<SqliteDriver> {
  const worker = new Worker(new URL("./opfs-worker.ts", import.meta.url), {
    type: "module",
  });

  const pending = new Map<number, { resolve: (r: Res) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let terminated = false;
  // Promise-based mutex: transaction() acquires this chain before sending
  // BEGIN; releases after COMMIT/ROLLBACK resolves.
  let transactionLock: Promise<void> = Promise.resolve();

  worker.addEventListener("message", (ev: MessageEvent<Res>) => {
    const slot = pending.get(ev.data.id);
    if (slot === undefined) return;
    pending.delete(ev.data.id);
    slot.resolve(ev.data);
  });

  worker.addEventListener("error", (ev: ErrorEvent) => {
    const err = new Error(`OPFS worker error: ${ev.message}`);
    for (const slot of pending.values()) slot.reject(err);
    pending.clear();
  });

  function send(req: ReqWithoutId, timeoutMs?: number): Promise<Res> {
    if (terminated) {
      return Promise.reject(new WorkerTerminatedError());
    }
    const id = nextId++;
    return new Promise<Res>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const full = { ...req, id } as Req;
      worker.postMessage(full);
      if (timeoutMs !== undefined) {
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new OpfsDriverUnavailableError(`OPFS worker: ${req.kind} timed out`));
          }
        }, timeoutMs);
      }
    });
  }

  async function call<T>(req: ReqWithoutId, timeoutMs?: number): Promise<T> {
    const res = await send(req, timeoutMs);
    if (!res.ok) {
      throw new OpfsDriverError(res.error.message, {
        code: res.error.code,
        name: res.error.name,
      });
    }
    return res.result as T;
  }

  try {
    await call<undefined>({ kind: "init" }, INIT_TIMEOUT_MS);
  } catch (err) {
    worker.terminate();
    terminated = true;
    if (err instanceof OpfsDriverUnavailableError) throw err;
    throw new OpfsDriverUnavailableError("OPFS worker failed to initialize", err);
  }

  // FinalizationRegistry: when a statement wrapper is GC'd, send finalize.
  const finalizer = new FinalizationRegistry<StmtHandle>((handle) => {
    void call<undefined>({ kind: "finalize", stmt: handle }).catch(() => undefined);
  });

  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      // prepare is async on the worker but the interface returns sync — we return
      // a "lazy" statement backed by a handle promise. Each method awaits it.
      const handlePromise = call<StmtHandle>({ kind: "prepare", sql });
      const wrapper: SqliteStatement<TRow> = {
        async run(...params: unknown[]): Promise<void> {
          const handle = await handlePromise;
          await call<undefined>({ kind: "run", stmt: handle, params: params as BindParam[] });
        },
        async all(...params: unknown[]): Promise<TRow[]> {
          const handle = await handlePromise;
          const rows = await call<Row[]>({
            kind: "all",
            stmt: handle,
            params: params as BindParam[],
          });
          return rows as TRow[];
        },
        async get(...params: unknown[]): Promise<TRow | undefined> {
          const handle = await handlePromise;
          const row = await call<Row | undefined>({
            kind: "get",
            stmt: handle,
            params: params as BindParam[],
          });
          return row as TRow | undefined;
        },
      };
      void handlePromise
        .then((h) => {
          finalizer.register(wrapper, h);
        })
        .catch(() => undefined);
      return wrapper;
    },

    exec(sql: string): Promise<void> {
      return call<undefined>({ kind: "exec", sql });
    },

    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      // Serialize transactions: chain against any prior pending txn.
      let release!: () => void;
      const next = new Promise<void>((r) => {
        release = r;
      });
      const prev = transactionLock;
      transactionLock = next;
      await prev;
      try {
        await call<undefined>({ kind: "txn-begin" });
        try {
          const result = await fn();
          await call<undefined>({ kind: "txn-commit" });
          return result;
        } catch (err) {
          await call<undefined>({ kind: "txn-rollback" }).catch(() => undefined);
          throw err;
        }
      } finally {
        release();
      }
    },

    async close(): Promise<void> {
      try {
        await call<undefined>({ kind: "close" });
      } finally {
        terminated = true;
        worker.terminate();
        for (const slot of pending.values()) {
          slot.reject(new WorkerTerminatedError());
        }
        pending.clear();
      }
    },
  };
}
