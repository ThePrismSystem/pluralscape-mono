/**
 * Async wrapper around the pwhash worker thread pool.
 *
 * Provides non-blocking hashPin/verifyPin/hashPassword/verifyPassword
 * by dispatching work to a small pool of worker threads that run
 * libsodium's Argon2id.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker as _Worker } from "node:worker_threads";

/** Thrown when the pwhash worker pool fails (timeout, crash, or error response). */
export class WorkerError extends Error {
  override readonly name = "WorkerError" as const;
}

// node:worker_threads Worker has .on() but Bun's ambient Worker type does not.
// Re-declare with the EventEmitter methods we actually use.
interface NodeWorker {
  on(event: "message", listener: (value: WorkerResponse) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  postMessage(value: unknown): void;
  terminate(): Promise<number>;
}
const _ctor: unknown = _Worker;
const Worker = _ctor as new (path: string) => NodeWorker;

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

let pool: NodeWorker[] | null = null;
let nextId = 0;
let roundRobin = 0;
const pending = new Map<number, PendingRequest>();

function getWorkerPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return join(currentDir, "pwhash-worker-thread.js");
}

function initPool(): NodeWorker[] {
  if (pool) return pool;

  const workerPath = getWorkerPath();
  pool = Array.from({ length: POOL_SIZE }, () => {
    const worker = new Worker(workerPath);
    worker.on("message", (msg: WorkerResponse) => {
      const req = pending.get(msg.id);
      if (!req) return;
      pending.delete(msg.id);
      if (msg.ok) {
        req.resolve(msg.value);
      } else {
        req.reject(new WorkerError(msg.error ?? "Worker error"));
      }
    });
    worker.on("error", (err: Error) => {
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

/** Timeout for worker operations (includes cold-start libsodium init). */
const DISPATCH_TIMEOUT_MS = 30_000;

function dispatch(message: Record<string, unknown>): Promise<unknown> {
  const workers = initPool();
  const id = nextId++;
  const worker = workers[roundRobin % workers.length] as NodeWorker;
  roundRobin++;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new WorkerError("pwhash worker timeout"));
    }, DISPATCH_TIMEOUT_MS);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
    worker.postMessage({ ...message, id });
  });
}

export async function hashPinOffload(pin: string, profile: "server"): Promise<string> {
  return dispatch({ op: "hash", pin, profile }) as Promise<string>;
}

export async function verifyPinOffload(hash: string, pin: string): Promise<boolean> {
  return dispatch({ op: "verify", hash, pin }) as Promise<boolean>;
}

/**
 * Derive a transfer key off the main thread using Argon2id.
 *
 * The branded AeadKey type is lost across the structured-clone boundary —
 * callers must re-assert via assertAeadKey.
 */
export async function hashPasswordOffload(password: string, profile: "server"): Promise<string> {
  return dispatch({ op: "hashPassword", password, profile }) as Promise<string>;
}

export async function verifyPasswordOffload(hash: string, password: string): Promise<boolean> {
  return dispatch({ op: "verifyPassword", hash, password }) as Promise<boolean>;
}

export async function deriveTransferKeyOffload(
  code: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return dispatch({ op: "deriveTransferKey", code, salt }) as Promise<Uint8Array>;
}

/** Shutdown the worker pool. Call from test cleanup. */
export async function _shutdownPool(): Promise<void> {
  if (!pool) return;
  await Promise.all(pool.map((w) => w.terminate()));
  pool = null;
  pending.clear();
}
