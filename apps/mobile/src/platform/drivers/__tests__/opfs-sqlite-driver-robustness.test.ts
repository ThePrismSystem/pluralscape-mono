/**
 * OPFS SQLite driver — robustness tests (error tagged kinds, per-call timeout,
 * worker error handling, observability logs).
 *
 * Companion files: opfs-sqlite-driver-proxy-init.test.ts,
 *                  opfs-sqlite-driver-proxy-errors.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpfsSqliteDriver } from "../opfs-sqlite-driver.js";
import {
  OpfsDriverError,
  OpfsDriverTimeoutError,
  OpfsDriverUnavailableError,
  WorkerTerminatedError,
} from "../opfs-worker-protocol.js";

import type { OpfsSqliteDriverOptions } from "../opfs-sqlite-driver.js";
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

interface FakeFinalizationRegistry {
  /** Invoke the registered callback with the last-registered handle. */
  fireForLastWrapper(): void;
}

interface SpawnResult {
  driver: SqliteDriver;
  controller: FakeWorker;
  terminateSpy: () => number;
  registry: FakeFinalizationRegistry;
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
let fakeRegistry: FakeFinalizationRegistry;

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
  fakeRegistry = {
    fireForLastWrapper(): void {
      const last = state.registered[state.registered.length - 1];
      if (last === undefined || state.callback === undefined) {
        throw new Error("no registered finalizer or no callback");
      }
      state.callback(last);
    },
  };
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
 * Tick budget for `flushMicrotasks`. The deepest await chain across these
 * tests is in `transaction()`: await prev → await txn-begin response →
 * await user fn (await exec response) → await txn-commit response. Eight
 * `await Promise.resolve()` cycles cover that depth with comfortable margin.
 * Bump if a future driver change adds awaits between sends.
 */
const MICROTASK_FLUSH_TICKS = 8;

/** Flush enough microtasks to drain a chain of awaited proxy sends. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < MICROTASK_FLUSH_TICKS; i++) {
    await Promise.resolve();
  }
}

/**
 * Init the driver and wrap the fake worker's `terminate` in a spy so tests
 * can assert on termination. Returns a bundle matching the plan's helper
 * shape (driver/controller/terminateSpy/registry).
 */
async function spawnDriverWithFakeWorker(opts: OpfsSqliteDriverOptions = {}): Promise<SpawnResult> {
  let terminateCount = 0;
  const origTerminate = fakeWorker.terminate.bind(fakeWorker);
  fakeWorker.terminate = function (): void {
    terminateCount++;
    origTerminate();
  };
  const pending = createOpfsSqliteDriver(opts);
  await Promise.resolve();
  const first = fakeWorker.posted[0];
  if (first?.kind !== "init") {
    throw new Error(`expected init as first request, got ${String(first?.kind)}`);
  }
  fakeWorker.fireMessage({ id: first.id, ok: true, result: undefined });
  const driver = await pending;
  return {
    driver,
    controller: fakeWorker,
    terminateSpy: () => terminateCount,
    registry: fakeRegistry,
  };
}

// ── New tests for Commit 2: driver robustness ─────────────────────────

describe("opfs error tagged kinds", () => {
  it("each error class has a stable `kind` discriminant", () => {
    expect(new OpfsDriverError("x").kind).toBe("driver");
    expect(new OpfsDriverUnavailableError("x").kind).toBe("unavailable");
    expect(new OpfsDriverTimeoutError("x").kind).toBe("timeout");
    expect(new WorkerTerminatedError().kind).toBe("terminated");
  });
});

describe("opfs driver — per-call timeout", () => {
  it("rejects with OpfsDriverTimeoutError when no response arrives within CALL_TIMEOUT_MS", async () => {
    vi.useFakeTimers();
    try {
      const { driver, controller } = await spawnDriverWithFakeWorker();
      const p = driver.exec("SELECT 1");
      // Attach rejection handler immediately to avoid spurious unhandled-rejection.
      const settled = expect(p).rejects.toBeInstanceOf(OpfsDriverTimeoutError);
      // No response. Advance past the 30s default.
      await vi.advanceTimersByTimeAsync(30_000 + 1);
      await settled;
      // Slot was cleared from the driver's internal pending map: a late
      // worker response with the same id must be a no-op (no throw, no
      // double-rejection). This proves the `pending.delete(id)` on timeout.
      const execReq = controller.posted.find((r) => r.kind === "exec");
      if (execReq === undefined) throw new Error("expected exec posted");
      expect(() => {
        controller.fireMessage({ id: execReq.id, ok: true, result: undefined });
      }).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("callTimeoutMs: null disables per-call timeout", async () => {
    vi.useFakeTimers();
    try {
      const { driver } = await spawnDriverWithFakeWorker({ callTimeoutMs: null });
      const p = driver.exec("SELECT 1");
      let settled = false;
      void p.then(
        () => (settled = true),
        () => (settled = true),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      // Promise still pending — no timer was armed.
      await Promise.resolve();
      expect(settled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("custom callTimeoutMs is respected", async () => {
    vi.useFakeTimers();
    try {
      const { driver } = await spawnDriverWithFakeWorker({ callTimeoutMs: 1_000 });
      const p = driver.exec("SELECT 1");
      const settled = expect(p).rejects.toBeInstanceOf(OpfsDriverTimeoutError);
      await vi.advanceTimersByTimeAsync(1_000 + 1);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("opfs driver — worker error handling", () => {
  it("close() is idempotent after worker error", async () => {
    const { driver, controller } = await spawnDriverWithFakeWorker();
    controller.fireWorkerError("boom");
    await expect(driver.close()).resolves.toBeUndefined();
    await expect(driver.close()).resolves.toBeUndefined();
  });

  it("worker.onerror calls worker.terminate", async () => {
    const { controller, terminateSpy } = await spawnDriverWithFakeWorker();
    controller.fireWorkerError("crash");
    expect(terminateSpy()).toBe(1);
  });

  it("worker.onerror rejects pending with WorkerTerminatedError", async () => {
    const { driver, controller } = await spawnDriverWithFakeWorker();
    const p = driver.exec("SELECT 1");
    // Swallow rejection synchronously to avoid unhandled-rejection noise.
    const assertion = expect(p).rejects.toBeInstanceOf(WorkerTerminatedError);
    controller.fireWorkerError("crash");
    await assertion;
  });

  it("panic envelope from worker terminates and rejects pending", async () => {
    const { driver, controller, terminateSpy } = await spawnDriverWithFakeWorker();
    const p = driver.exec("SELECT 1");
    const assertion = expect(p).rejects.toBeInstanceOf(WorkerTerminatedError);
    controller.fireMessage({
      id: -1,
      ok: false,
      panic: true,
      error: { name: "messageerror", message: "non-cloneable" },
    });
    await assertion;
    expect(terminateSpy()).toBe(1);
  });
});

describe("opfs driver — observability logs", () => {
  it("logs rollback failure but original txn error propagates", async () => {
    const warn = vi.spyOn(globalThis.console, "warn").mockImplementation(() => undefined);
    try {
      const { driver, controller } = await spawnDriverWithFakeWorker();

      controller.routeKind("txn-begin", () => undefined);
      controller.routeKind("txn-rollback", () => {
        throw new OpfsDriverError("rollback exploded");
      });

      await expect(
        driver.transaction(() => {
          throw new Error("user code boom");
        }),
      ).rejects.toThrow("user code boom");

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("opfs txn rollback failed"));
    } finally {
      warn.mockRestore();
    }
  });

  it("logs finalize-on-GC failure via console.warn", async () => {
    const warn = vi.spyOn(globalThis.console, "warn").mockImplementation(() => undefined);
    try {
      const { driver, controller, registry } = await spawnDriverWithFakeWorker();
      // Route prepare so the statement wrapper's handlePromise resolves and
      // the finalizer is registered. Then route finalize to fail.
      controller.routeKind("prepare", () => 42);
      driver.prepare("SELECT 1");
      await flushMicrotasks();
      controller.routeKind("finalize", () => {
        throw new OpfsDriverError("finalize boom");
      });
      registry.fireForLastWrapper();
      await flushMicrotasks();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("opfs finalize failed"));
    } finally {
      warn.mockRestore();
    }
  });
});
