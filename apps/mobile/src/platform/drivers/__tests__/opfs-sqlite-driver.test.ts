/**
 * Protocol-oriented tests for the OPFS SQLite driver proxy.
 *
 * The driver under test is a thin main-thread proxy that posts typed
 * `Req` messages to a Web Worker and awaits typed `Res` replies. We
 * substitute a fake Worker implementation onto `globalThis.Worker` so
 * the tests assert on the wire-level protocol — the request kinds,
 * payloads, and ordering — rather than mocking sqlite primitives.
 *
 * No real worker is spawned. No WASM is loaded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpfsSqliteDriver } from "../opfs-sqlite-driver.js";
import {
  OpfsDriverError,
  OpfsDriverUnavailableError,
  WorkerTerminatedError,
} from "../opfs-worker-protocol.js";

import type { Req, Res } from "../opfs-worker-protocol.js";
import type { SqliteDriver } from "@pluralscape/sync/adapters";

type MessageListener = (ev: MessageEvent<Res>) => void;
type ErrorListener = (ev: ErrorEvent) => void;

interface FakeWorker {
  listeners: { message: MessageListener[]; error: ErrorListener[] };
  posted: Req[];
  terminated: boolean;
  addEventListener(type: "message", l: MessageListener): void;
  addEventListener(type: "error", l: ErrorListener): void;
  postMessage(msg: Req): void;
  terminate(): void;
  /** Dispatch a worker→main response to all message listeners. */
  respond(res: Res): void;
  /** Dispatch a worker error event (also flips `terminated` in the driver). */
  triggerError(message: string): void;
}

function makeFakeWorker(): FakeWorker {
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
    },
    terminate(): void {
      this.terminated = true;
    },
    respond(res: Res): void {
      // Plain object cast: jsdom's MessageEvent constructor isn't available
      // in the Node test env, but the driver only reads `.data`.
      const ev = { data: res } as MessageEvent<Res>;
      for (const l of this.listeners.message) l(ev);
    },
    triggerError(message: string): void {
      const ev = { message } as ErrorEvent;
      for (const l of this.listeners.error) l(ev);
    },
  };
  return fw;
}

let fakeWorker: FakeWorker;
let originalWorker: typeof globalThis.Worker | undefined;

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
 * Drive the init handshake: wait for the driver to post `init`, respond ok,
 * and return the resolved driver.
 */
async function initDriver(): Promise<SqliteDriver> {
  const pending = createOpfsSqliteDriver();
  // Microtask flush so the driver's first send() runs and `posted[0]` exists.
  await Promise.resolve();
  const first = fakeWorker.posted[0];
  if (first?.kind !== "init") {
    throw new Error(`expected init as first request, got ${String(first?.kind)}`);
  }
  fakeWorker.respond({ id: first.id, ok: true, result: undefined });
  return pending;
}

describe("createOpfsSqliteDriver — proxy protocol", () => {
  it("posts init as the first message and resolves once the worker replies ok", async () => {
    const pending = createOpfsSqliteDriver();
    await Promise.resolve();
    expect(fakeWorker.posted).toHaveLength(1);
    const initReq = fakeWorker.posted[0];
    expect(initReq?.kind).toBe("init");
    if (initReq === undefined) throw new Error("init request missing");
    fakeWorker.respond({ id: initReq.id, ok: true, result: undefined });
    await expect(pending).resolves.toBeDefined();
  });

  it("prepare() returns synchronously; run() posts prepare then run with the resolved handle", async () => {
    const driver = await initDriver();
    const stmt = driver.prepare("INSERT INTO t VALUES (?)");

    const runPromise = stmt.run("value");
    // Microtask flush so the lazy prepare send() lands in `posted`.
    await Promise.resolve();
    const prepReq = fakeWorker.posted[1];
    if (prepReq?.kind !== "prepare") {
      throw new Error(`expected prepare, got ${String(prepReq?.kind)}`);
    }
    expect(prepReq.sql).toBe("INSERT INTO t VALUES (?)");
    fakeWorker.respond({ id: prepReq.id, ok: true, result: 101 });

    // After prepare resolves, run() awaits the handle and posts the run req.
    await Promise.resolve();
    await Promise.resolve();
    const runReq = fakeWorker.posted[2];
    if (runReq?.kind !== "run") {
      throw new Error(`expected run, got ${String(runReq?.kind)}`);
    }
    expect(runReq.stmt).toBe(101);
    expect(runReq.params).toEqual(["value"]);
    fakeWorker.respond({ id: runReq.id, ok: true, result: undefined });

    await expect(runPromise).resolves.toBeUndefined();
  });

  it("all() returns rows from the worker response with the bound params", async () => {
    const driver = await initDriver();
    interface UserRow {
      id: number;
      name: string;
    }
    const stmt = driver.prepare<UserRow>("SELECT * FROM users WHERE id = ?");
    const allPromise = stmt.all(7);

    await Promise.resolve();
    const prepReq = fakeWorker.posted[1];
    if (prepReq?.kind !== "prepare") {
      throw new Error(`expected prepare, got ${String(prepReq?.kind)}`);
    }
    fakeWorker.respond({ id: prepReq.id, ok: true, result: 102 });

    await Promise.resolve();
    await Promise.resolve();
    const allReq = fakeWorker.posted[2];
    if (allReq?.kind !== "all") {
      throw new Error(`expected all, got ${String(allReq?.kind)}`);
    }
    expect(allReq.stmt).toBe(102);
    expect(allReq.params).toEqual([7]);
    fakeWorker.respond({
      id: allReq.id,
      ok: true,
      result: [{ id: 7, name: "found" }],
    });

    await expect(allPromise).resolves.toEqual([{ id: 7, name: "found" }]);
  });

  it("exec() rejects with OpfsDriverError when the response is ok:false", async () => {
    const driver = await initDriver();
    const execPromise = driver.exec("BAD SQL");
    await Promise.resolve();
    const execReq = fakeWorker.posted[1];
    if (execReq?.kind !== "exec") {
      throw new Error(`expected exec, got ${String(execReq?.kind)}`);
    }
    fakeWorker.respond({
      id: execReq.id,
      ok: false,
      error: { message: "syntax error", code: 1, name: "OpfsDriverError" },
    });
    await expect(execPromise).rejects.toBeInstanceOf(OpfsDriverError);
    await expect(execPromise).rejects.toThrow(/syntax error/);
  });

  it("serializes concurrent transaction() calls — second txn-begin waits for first commit", async () => {
    const driver = await initDriver();

    const t1 = driver.transaction(async () => {
      await driver.exec("step1");
      return "t1-done";
    });
    const t2 = driver.transaction(async () => {
      await driver.exec("step2");
      return "t2-done";
    });

    // First txn-begin should land. The second transaction is parked on the
    // promise mutex — no second txn-begin should appear yet.
    await Promise.resolve();
    const beginReqs1 = fakeWorker.posted.filter((r) => r.kind === "txn-begin");
    expect(beginReqs1).toHaveLength(1);
    const begin1 = beginReqs1[0];
    if (begin1 === undefined) throw new Error("expected first txn-begin");
    fakeWorker.respond({ id: begin1.id, ok: true, result: undefined });

    // The user fn now runs; flush microtasks so its exec() lands.
    await Promise.resolve();
    await Promise.resolve();
    const exec1 = fakeWorker.posted.find((r) => r.kind === "exec" && r.sql === "step1");
    if (exec1 === undefined) throw new Error("expected step1 exec");
    fakeWorker.respond({ id: exec1.id, ok: true, result: undefined });

    // Flush enough microtasks for the user fn to await exec1 and the
    // transaction body to schedule the txn-commit send.
    await flushMicrotasks();
    // Commit MUST have posted — otherwise a release-without-commit regression
    // would silently pass the begin-count assertion below.
    const commit1 = fakeWorker.posted.find((r) => r.kind === "txn-commit");
    expect(commit1).toBeDefined();
    if (commit1 === undefined) throw new Error("expected txn-commit for t1");

    // Crucial assertion: while t1's commit is in flight, t2's BEGIN must not
    // have been posted. The mutex releases only after commit resolves.
    const beginReqsBeforeCommit = fakeWorker.posted.filter((r) => r.kind === "txn-begin");
    expect(beginReqsBeforeCommit).toHaveLength(1);

    fakeWorker.respond({ id: commit1.id, ok: true, result: undefined });
    await expect(t1).resolves.toBe("t1-done");

    // Now the lock is released — t2's BEGIN should follow.
    await Promise.resolve();
    await Promise.resolve();
    const beginReqs2 = fakeWorker.posted.filter((r) => r.kind === "txn-begin");
    expect(beginReqs2).toHaveLength(2);
    const begin2 = beginReqs2[1];
    if (begin2 === undefined) throw new Error("expected second txn-begin");
    fakeWorker.respond({ id: begin2.id, ok: true, result: undefined });

    await flushMicrotasks();
    const exec2 = fakeWorker.posted.find((r) => r.kind === "exec" && r.sql === "step2");
    if (exec2 === undefined) throw new Error("expected step2 exec");
    fakeWorker.respond({ id: exec2.id, ok: true, result: undefined });

    await flushMicrotasks();
    const commit2 = fakeWorker.posted.filter((r) => r.kind === "txn-commit")[1];
    if (commit2 === undefined) throw new Error("expected txn-commit for t2");
    fakeWorker.respond({ id: commit2.id, ok: true, result: undefined });
    await expect(t2).resolves.toBe("t2-done");
  });

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
    fakeWorker.respond({ id: closeReq.id, ok: true, result: undefined });

    await expect(closePromise).resolves.toBeUndefined();
    await expect(pendingExec).rejects.toBeInstanceOf(WorkerTerminatedError);
    expect(fakeWorker.terminated).toBe(true);
  });

  it("worker error event marks the driver terminated; subsequent exec() rejects synchronously", async () => {
    const driver = await initDriver();

    // Trip the error handler. Per Task 14: terminated flag is set.
    fakeWorker.triggerError("worker crashed");

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
    fakeWorker.respond({
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
    fakeWorker.respond({ id: prepReq.id, ok: true, result: 200 });

    await Promise.resolve();
    await Promise.resolve();
    const getReq = fakeWorker.posted[2];
    if (getReq?.kind !== "get") {
      throw new Error(`expected get, got ${String(getReq?.kind)}`);
    }
    expect(getReq.stmt).toBe(200);
    expect(getReq.params).toEqual([42]);
    fakeWorker.respond({
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
    fakeWorker.respond({ id: beginReq.id, ok: true, result: undefined });

    // After BEGIN resolves, the user fn runs synchronously and throws,
    // so the driver posts txn-rollback.
    await Promise.resolve();
    await Promise.resolve();
    const rollbackReq = fakeWorker.posted.find((r) => r.kind === "txn-rollback");
    if (rollbackReq === undefined) throw new Error("expected txn-rollback");
    // Even if the rollback "fails", the user error must propagate. Reply with
    // ok:false to verify the rollback error is swallowed and the original
    // user error wins.
    fakeWorker.respond({
      id: rollbackReq.id,
      ok: false,
      error: { message: "rollback also failed" },
    });

    await expect(txnPromise).rejects.toBe(userError);
    // Commit must NOT have been posted on the throw path.
    expect(fakeWorker.posted.find((r) => r.kind === "txn-commit")).toBeUndefined();
  });
});
