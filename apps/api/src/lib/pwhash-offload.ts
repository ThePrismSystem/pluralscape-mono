/**
 * Async wrapper around the pwhash worker thread pool.
 *
 * Provides non-blocking hashPin/verifyPin by dispatching work to a
 * small pool of worker threads that run libsodium's Argon2id.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const POOL_SIZE = 2;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface WorkerResponse {
  readonly id: number;
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
}

/**
 * Bun's Worker from node:worker_threads supports Node-style .on() at
 * runtime but @types/bun doesn't declare it on the Worker class.
 */
interface WorkerEmitter {
  on(event: "message", fn: (msg: WorkerResponse) => void): void;
  on(event: "error", fn: (err: Error) => void): void;
  postMessage(msg: unknown): void;
}

/** Narrow Worker to its event-emitter interface that Bun supports at runtime. */
function asEmitter(w: Worker): WorkerEmitter {
  // Worker extends EventEmitter in Node and Bun, but @types/bun omits it
  return w as never;
}

let pool: Worker[] | null = null;
let nextId = 0;
let roundRobin = 0;
const pending = new Map<number, PendingRequest>();

function getWorkerPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "pwhash-worker-thread.js");
}

function initPool(): Worker[] {
  if (pool) return pool;

  const workerPath = getWorkerPath();
  pool = Array.from({ length: POOL_SIZE }, () => {
    const worker = new Worker(workerPath);
    const emitter = asEmitter(worker);
    emitter.on("message", (msg: WorkerResponse) => {
      const req = pending.get(msg.id);
      if (!req) return;
      pending.delete(msg.id);
      if (msg.ok) {
        req.resolve(msg.value);
      } else {
        req.reject(new Error(msg.error ?? "Worker error"));
      }
    });
    emitter.on("error", (err: Error) => {
      // Reject all pending requests on this worker
      for (const [id, req] of pending) {
        req.reject(err);
        pending.delete(id);
      }
    });
    return worker;
  });

  return pool;
}

function dispatch(message: Record<string, unknown>): Promise<unknown> {
  const workers = initPool();
  const id = nextId++;
  const worker = workers[roundRobin % workers.length] as Worker;
  roundRobin++;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...message, id });
  });
}

export async function hashPinOffload(pin: string, profile: "server"): Promise<string> {
  return dispatch({ op: "hash", pin, profile }) as Promise<string>;
}

export async function verifyPinOffload(hash: string, pin: string): Promise<boolean> {
  return dispatch({ op: "verify", hash, pin }) as Promise<boolean>;
}

/** Shutdown the worker pool. Call from test cleanup. */
export async function _shutdownPool(): Promise<void> {
  if (!pool) return;
  await Promise.all(pool.map((w) => w.terminate()));
  pool = null;
  pending.clear();
}
