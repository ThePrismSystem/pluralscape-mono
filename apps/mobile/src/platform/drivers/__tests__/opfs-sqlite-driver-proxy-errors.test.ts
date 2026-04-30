/**
 * OPFS SQLite driver — proxy protocol error paths (close cleanup, worker
 * error termination, init timeout/failure, get(), txn rollback on throw).
 *
 * Companion files: opfs-sqlite-driver-proxy-init.test.ts,
 *                  opfs-sqlite-driver-robustness.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpfsSqliteDriver } from "../opfs-sqlite-driver.js";
import { OpfsDriverUnavailableError, WorkerTerminatedError } from "../opfs-worker-protocol.js";

import type { OkResult, Req, Res, StmtHandle } from "../opfs-worker-protocol.js";
import type { SqliteDriver } from "@pluralscape/sync/adapters";

type MessageListener = (ev: MessageEvent<Res>) => void;
type ErrorListener = (ev: ErrorEvent) => void;
/**
 * Return value of a routed handler, which the FakeWorker wraps into an
 * `ok: true` response. Matches the union of `OkResult` payloads that the
 * real worker can return for any request kind.
 */
type RouteHandler = (req: Req) => OkResult | Promise<OkResult>;

interface FakeWorker {
  listeners: { message: MessageListener[]; error: ErrorListener[] };
  posted: Req[];
  terminated: boolean;
  addEventListener(type: "message", l: MessageListener): void;
  addEventListener(type: "error", l: ErrorListener): void;
  postMessage(msg: Req): void;
  terminate(): void;
  /** Dispatch a worker→main response to all message listeners. */
  fireMessage(res: Res): void;
  /** Dispatch a worker error event (also flips `terminated` in the driver). */
  fireWorkerError(message: string): void;
  /**
   * Register a route handler keyed on request kind. When the driver posts a
   * request of that kind, the handler is invoked and the result (resolved or
   * rejected) is converted into a worker response and dispatched. Target
   * rollback/finalize failure paths by throwing from the handler.
   */
  routeKind(kind: Req["kind"], handler: RouteHandler): void;
}

function makeFakeWorker(): FakeWorker {
  const routes = new Map<Req["kind"], RouteHandler>();

  const fw: FakeWorker = {
    listeners: { message: [], error: [] },
    posted: [],
    terminated: false,
    addEventListener(type: "message" | "error", l: MessageListener | ErrorListener): void {
      if (type === "message") {
        this.listeners.message.push(l as MessageListener);
      } else {
        this.listeners.error.push(l as ErrorListener);
      }
    },
    postMessage(msg: Req): void {
      this.posted.push(msg);
      const handler = routes.get(msg.kind);
      if (handler !== undefined) {
        // Resolve handler asynchronously so postMessage returns before the
        // response is dispatched — mirrors the real worker's async step().
        void Promise.resolve()
          .then(() => handler(msg))
          .then((result) => {
            fw.fireMessage({ id: msg.id, ok: true, result });
          })
          .catch((err: unknown) => {
            const e = err instanceof Error ? err : new Error(String(err));
            fw.fireMessage({
              id: msg.id,
              ok: false,
              error: { message: e.message, name: e.name },
            });
          });
      }
    },
    terminate(): void {
      this.terminated = true;
    },
    fireMessage(res: Res): void {
      // Plain object cast: jsdom's MessageEvent constructor isn't available
      // in the Node test env, but the driver only reads `.data`.
      const ev = { data: res } as MessageEvent<Res>;
      for (const l of this.listeners.message) l(ev);
    },
    fireWorkerError(message: string): void {
      const ev = { message } as ErrorEvent;
      for (const l of this.listeners.error) l(ev);
    },
    routeKind(kind: Req["kind"], handler: RouteHandler): void {
      routes.set(kind, handler);
    },
  };
  return fw;
}

let fakeWorker: FakeWorker;
let originalWorker: typeof globalThis.Worker | undefined;
let originalFinalizationRegistry: typeof globalThis.FinalizationRegistry;

beforeEach(() => {
  fakeWorker = makeFakeWorker();
  originalWorker = (globalThis as { Worker?: typeof globalThis.Worker }).Worker;
  // The driver instantiates the worker via `new Worker(...)`, so we need a
  // constructor (not an arrow). Returning the prepared `fakeWorker` from the
  // ctor lets the driver register listeners and post messages against it.
  function FakeWorkerCtor(): FakeWorker {
    return fakeWorker;
  }
  Object.defineProperty(globalThis, "Worker", {
    value: FakeWorkerCtor,
    configurable: true,
    writable: true,
  });

  // Install a fake FinalizationRegistry so tests can synchronously trigger
  // the finalize path that real GC would exercise.
  originalFinalizationRegistry = globalThis.FinalizationRegistry;
  const state: {
    callback?: (handle: StmtHandle) => void;
    registered: StmtHandle[];
  } = { registered: [] };
  class FakeFinalizationRegistryCtor {
    // The driver only instantiates FinalizationRegistry<StmtHandle>, so the
    // fake fixes T = StmtHandle — no generic, no force-casts.
    constructor(cb: (value: StmtHandle) => void) {
      state.callback = cb;
    }
    register(_target: object, value: StmtHandle): void {
      state.registered.push(value);
    }
    unregister(): boolean {
      return false;
    }
  }
  Object.defineProperty(globalThis, "FinalizationRegistry", {
    value: FakeFinalizationRegistryCtor,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (originalWorker === undefined) {
    delete (globalThis as { Worker?: typeof globalThis.Worker }).Worker;
  } else {
    Object.defineProperty(globalThis, "Worker", {
      value: originalWorker,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis, "FinalizationRegistry", {
    value: originalFinalizationRegistry,
    configurable: true,
    writable: true,
  });
});

/**
 * Drive the init handshake: wait for the driver to post `init`, respond ok,
 * and return the resolved driver.
 */
async function initDriver(): Promise<SqliteDriver> {
  const pending = createOpfsSqliteDriver();
  await Promise.resolve();
  const first = fakeWorker.posted[0];
  if (first?.kind !== "init") {
    throw new Error(`expected init as first request, got ${String(first?.kind)}`);
  }
  fakeWorker.fireMessage({ id: first.id, ok: true, result: undefined });
  return pending;
}

describe("createOpfsSqliteDriver — proxy protocol (errors)", () => {
  it("close() rejects pending requests with WorkerTerminatedError after the close response", async () => {
    const driver = await initDriver();
    const pendingExec = driver.exec("SELECT 1");
    // Don't respond to the exec — it stays in the pending Map.
    await Promise.resolve();
    const execReq = fakeWorker.posted[1];
    expect(execReq?.kind).toBe("exec");

    const closePromise = driver.close();
    await Promise.resolve();
    const closeReq = fakeWorker.posted.find((r) => r.kind === "close");
    if (closeReq === undefined) throw new Error("expected close request");
    fakeWorker.fireMessage({ id: closeReq.id, ok: true, result: undefined });

    await expect(closePromise).resolves.toBeUndefined();
    await expect(pendingExec).rejects.toBeInstanceOf(WorkerTerminatedError);
    expect(fakeWorker.terminated).toBe(true);
  });

  it("worker error event marks the driver terminated; subsequent exec() rejects synchronously", async () => {
    const driver = await initDriver();

    // Trip the error handler: terminated flag is set + terminate called.
    fakeWorker.fireWorkerError("worker crashed");

    // The next exec() must reject with WorkerTerminatedError without
    // posting a new message. We assert no new request was posted (only
    // the prior init lives in `posted`).
    const postedBefore = fakeWorker.posted.length;
    const rejected = driver.exec("SELECT 1");
    await expect(rejected).rejects.toBeInstanceOf(WorkerTerminatedError);
    expect(fakeWorker.posted.length).toBe(postedBefore);
  });

  it("init timeout (5s) rejects with OpfsDriverUnavailableError when the worker never responds", async () => {
    vi.useFakeTimers();
    try {
      const pending = createOpfsSqliteDriver();
      // Attach a rejection handler immediately so the rejection scheduled by
      // the timeout is never momentarily unhandled (avoids spurious
      // PromiseRejectionHandledWarning under fake timers).
      const settled = expect(pending).rejects.toBeInstanceOf(OpfsDriverUnavailableError);

      // Microtask flush so init posts and its setTimeout is scheduled.
      await Promise.resolve();
      expect(fakeWorker.posted[0]?.kind).toBe("init");

      // Don't respond; advance past the 5s init timeout.
      await vi.advanceTimersByTimeAsync(5_000);

      await settled;
      // The driver's catch block also terminates the worker on init failure.
      expect(fakeWorker.terminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("init failure (ok:false) terminates the worker", async () => {
    const pending = createOpfsSqliteDriver();
    await Promise.resolve();
    const initReq = fakeWorker.posted[0];
    if (initReq?.kind !== "init") throw new Error("expected init");
    fakeWorker.fireMessage({
      id: initReq.id,
      ok: false,
      error: { message: "wasm load failed" },
    });

    await expect(pending).rejects.toBeInstanceOf(OpfsDriverUnavailableError);
    expect(fakeWorker.terminated).toBe(true);
  });

  it("get() returns the row from the worker response typed as TRow | undefined", async () => {
    const driver = await initDriver();
    interface MemberRow {
      id: number;
      name: string;
    }
    const stmt = driver.prepare<MemberRow>("SELECT * FROM members WHERE id = ?");
    const getPromise = stmt.get(42);

    await Promise.resolve();
    const prepReq = fakeWorker.posted[1];
    if (prepReq?.kind !== "prepare") {
      throw new Error(`expected prepare, got ${String(prepReq?.kind)}`);
    }
    fakeWorker.fireMessage({ id: prepReq.id, ok: true, result: 200 });

    await Promise.resolve();
    await Promise.resolve();
    const getReq = fakeWorker.posted[2];
    if (getReq?.kind !== "get") {
      throw new Error(`expected get, got ${String(getReq?.kind)}`);
    }
    expect(getReq.stmt).toBe(200);
    expect(getReq.params).toEqual([42]);
    fakeWorker.fireMessage({
      id: getReq.id,
      ok: true,
      result: { id: 42, name: "Alex" },
    });

    const row = await getPromise;
    expect(row).toEqual({ id: 42, name: "Alex" });
  });

  it("transaction() rolls back on user-fn throw and re-throws the original error", async () => {
    const driver = await initDriver();

    const userError = new Error("user fn boom");
    const txnPromise = driver.transaction(() => {
      throw userError;
    });

    await Promise.resolve();
    const beginReq = fakeWorker.posted.find((r) => r.kind === "txn-begin");
    if (beginReq === undefined) throw new Error("expected txn-begin");
    fakeWorker.fireMessage({ id: beginReq.id, ok: true, result: undefined });

    // After BEGIN resolves, the user fn runs synchronously and throws,
    // so the driver posts txn-rollback.
    await Promise.resolve();
    await Promise.resolve();
    const rollbackReq = fakeWorker.posted.find((r) => r.kind === "txn-rollback");
    if (rollbackReq === undefined) throw new Error("expected txn-rollback");
    // Even if the rollback "fails", the user error must propagate. Reply with
    // ok:false to verify the rollback error is swallowed and the original
    // user error wins.
    fakeWorker.fireMessage({
      id: rollbackReq.id,
      ok: false,
      error: { message: "rollback also failed" },
    });

    await expect(txnPromise).rejects.toBe(userError);
    // Commit must NOT have been posted on the throw path.
    expect(fakeWorker.posted.find((r) => r.kind === "txn-commit")).toBeUndefined();
  });
});
