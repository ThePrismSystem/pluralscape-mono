import { CALL_TIMEOUT_MS, INIT_TIMEOUT_MS } from "./opfs-sqlite-driver.constants.js";
import {
  OpfsDriverError,
  OpfsDriverTimeoutError,
  OpfsDriverUnavailableError,
  WorkerTerminatedError,
} from "./opfs-worker-protocol.js";

import type { BindParam, Req, Res, ResultFor, StmtHandle } from "./opfs-worker-protocol.js";
import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

/**
 * Distributive Omit: applied to a discriminated union, produces a union of
 * per-member Omits. The built-in Omit is non-distributive and collapses the
 * variants to their shared keys, which erases our protocol's discriminants.
 *
 * The `T extends Req` wrapper forces TS to distribute across the union
 * before applying `Omit`, so each variant retains its own `kind` + payload.
 */
type ReqWithoutId<T extends Req = Req> = T extends Req ? Omit<T, "id"> : never;

export interface OpfsSqliteDriverOptions {
  /** Per-call timeout in ms; null disables. Default: CALL_TIMEOUT_MS. */
  callTimeoutMs?: number | null;
}

/**
 * wa-sqlite over OPFS, hosted in a dedicated Web Worker.
 *
 * Main thread is a thin proxy: each driver call serializes a typed request,
 * posts it to the worker, and resolves with the response. No SharedArrayBuffer,
 * no Atomics, no cross-origin isolation required.
 */
export async function createOpfsSqliteDriver(
  options: OpfsSqliteDriverOptions = {},
): Promise<SqliteDriver> {
  const worker = new Worker(new URL("./opfs-worker.ts", import.meta.url), {
    type: "module",
  });

  interface PendingSlot {
    resolve: (r: Res) => void;
    reject: (e: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
  }
  const pending = new Map<number, PendingSlot>();
  let nextId = 1;
  let terminated = false;
  // Tri-state timeout convention used throughout: undefined → fall back to
  // perCallTimeoutMs, null → disabled, number → explicit ms. Applies to the
  // option here and to send()'s per-request override.
  const perCallTimeoutMs: number | null =
    options.callTimeoutMs === undefined ? CALL_TIMEOUT_MS : options.callTimeoutMs;
  // Promise-based mutex: transaction() acquires this chain before sending
  // BEGIN; releases after COMMIT/ROLLBACK resolves. The chain is built from
  // resolve-only promises (release() is the resolver), so `await prev` never
  // throws — load-bearing assumption for `await prev` in transaction().
  let transactionLock: Promise<void> = Promise.resolve();

  worker.addEventListener("message", (ev: MessageEvent<Res>) => {
    const data = ev.data;
    // Panic envelope: worker detected a non-cloneable message or uncaught
    // error. The `panic` property is unique to that variant; its presence
    // narrows TS to `{id: -1, ok: false, panic: true, error}`.
    if (!data.ok && "panic" in data) {
      worker.terminate();
      terminated = true;
      const err = new WorkerTerminatedError(
        `OPFS worker panic: ${data.error.name ?? "Error"}: ${data.error.message}`,
      );
      for (const slot of pending.values()) {
        if (slot.timer !== undefined) clearTimeout(slot.timer);
        slot.reject(err);
      }
      pending.clear();
      return;
    }
    const slot = pending.get(data.id);
    if (slot === undefined) return;
    pending.delete(data.id);
    if (slot.timer !== undefined) clearTimeout(slot.timer);
    slot.resolve(data);
  });

  worker.addEventListener("error", (ev: ErrorEvent) => {
    // Defensively terminate — the worker may still be live but misbehaving,
    // and we don't want further messages or resource retention.
    worker.terminate();
    terminated = true;
    const err = new WorkerTerminatedError(`OPFS worker error: ${ev.message}`);
    for (const slot of pending.values()) {
      if (slot.timer !== undefined) clearTimeout(slot.timer);
      slot.reject(err);
    }
    pending.clear();
  });

  async function send<K extends Req["kind"]>(
    req: Extract<ReqWithoutId, { kind: K }>,
    timeoutMs?: number | null,
  ): Promise<ResultFor<K>> {
    if (terminated) throw new WorkerTerminatedError();
    const id = nextId++;
    const effective = timeoutMs === undefined ? perCallTimeoutMs : timeoutMs;
    const res = await new Promise<Res>((resolve, reject) => {
      const slot: PendingSlot = { resolve, reject };
      pending.set(id, slot);
      const full = { ...req, id } as Req;
      try {
        worker.postMessage(full);
      } catch (err) {
        // postMessage can throw on non-cloneable payloads or if the worker
        // was terminated between our `terminated` check and here. Clean up
        // the slot to avoid leaking a pending entry that will never settle.
        // No timer to clear — it's armed only after postMessage succeeds.
        pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      if (effective !== null) {
        slot.timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(
              new OpfsDriverTimeoutError(
                `OPFS worker: ${req.kind} timed out after ${String(effective)}ms`,
              ),
            );
          }
        }, effective);
      }
    });
    if (!res.ok) {
      throw new OpfsDriverError(res.error.message, {
        code: res.error.code,
        name: res.error.name,
      });
    }
    return res.result as ResultFor<K>;
  }

  try {
    await send({ kind: "init" }, INIT_TIMEOUT_MS);
  } catch (err) {
    worker.terminate();
    terminated = true;
    if (err instanceof OpfsDriverUnavailableError) throw err;
    throw new OpfsDriverUnavailableError("OPFS worker failed to initialize", err);
  }

  const finalizer = new FinalizationRegistry<StmtHandle>((handle) => {
    void send({ kind: "finalize", stmt: handle }).catch((err: unknown) => {
      globalThis.console.warn("opfs finalize failed", err);
    });
  });

  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      // prepare is async on the worker but the interface returns sync — we return
      // a "lazy" statement backed by a handle promise. Each method awaits it.
      const handlePromise = send({ kind: "prepare", sql });
      const wrapper: SqliteStatement<TRow> = {
        async run(...params: unknown[]): Promise<void> {
          const handle = await handlePromise;
          await send({ kind: "run", stmt: handle, params: params as BindParam[] });
        },
        async all(...params: unknown[]): Promise<TRow[]> {
          const handle = await handlePromise;
          const rows = await send({
            kind: "all",
            stmt: handle,
            params: params as BindParam[],
          });
          return rows as TRow[];
        },
        async get(...params: unknown[]): Promise<TRow | undefined> {
          const handle = await handlePromise;
          const row = await send({
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

    async exec(sql: string): Promise<void> {
      await send({ kind: "exec", sql });
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
        await send({ kind: "txn-begin" });
        try {
          const result = await fn();
          await send({ kind: "txn-commit" });
          return result;
        } catch (err) {
          await send({ kind: "txn-rollback" }).catch((rollbackErr: unknown) => {
            globalThis.console.warn("opfs txn rollback failed", rollbackErr);
          });
          throw err;
        }
      } finally {
        release();
      }
    },

    async close(): Promise<void> {
      try {
        await send({ kind: "close" }).catch((err: unknown) => {
          // If the worker already crashed, close's own message won't round-trip.
          // Swallow the terminated signal so close() remains idempotent.
          if (!(err instanceof WorkerTerminatedError)) throw err;
        });
      } finally {
        terminated = true;
        worker.terminate();
        for (const slot of pending.values()) {
          if (slot.timer !== undefined) clearTimeout(slot.timer);
          slot.reject(new WorkerTerminatedError("driver closed"));
        }
        pending.clear();
      }
    },
  };
}
