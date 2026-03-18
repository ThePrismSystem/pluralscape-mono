import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mock Worker class ──────────────────────────────────────────────────
interface MockWorker {
  on: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}

const mockWorkers: MockWorker[] = [];

vi.mock("node:worker_threads", () => {
  // Use a real class so `new Worker(...)` works as a constructor.
  class FakeWorker implements MockWorker {
    on = vi.fn();
    postMessage = vi.fn();
    terminate = vi.fn().mockResolvedValue(undefined);
    constructor() {
      mockWorkers.push(this);
    }
  }
  return { Worker: FakeWorker };
});

// Dynamic import so the mock is in place before module evaluation.
const { hashPinOffload, verifyPinOffload, _shutdownPool } =
  await import("../../lib/pwhash-offload.js");

// ── Helpers ────────────────────────────────────────────────────────────

/** Find the handler registered for a given event on a mock worker. */
function getHandler(worker: MockWorker, event: string): (msg: unknown) => void {
  const call = worker.on.mock.calls.find((c: unknown[]) => c[0] === event);
  if (!call) throw new Error(`No "${event}" handler registered on worker`);
  return call[1] as (msg: unknown) => void;
}

/**
 * Find the worker that received a postMessage call and return it along
 * with the sent message. Handles the fact that `roundRobin` persists
 * across tests and we cannot predict which worker index receives the dispatch.
 */
function findDispatchedWorker(): { worker: MockWorker; sentMsg: Record<string, unknown> } {
  for (const w of mockWorkers) {
    if (w.postMessage.mock.calls.length > 0) {
      const lastCallIdx = w.postMessage.mock.calls.length - 1;
      const call = w.postMessage.mock.calls[lastCallIdx] as unknown[];
      return {
        worker: w,
        sentMsg: call[0] as Record<string, unknown>,
      };
    }
  }
  throw new Error("No worker received a postMessage call");
}

/** Resolve a dispatched request via its worker's message handler. */
function resolveDispatch(
  worker: MockWorker,
  sentMsg: Record<string, unknown>,
  value: unknown,
): void {
  const handler = getHandler(worker, "message");
  handler({ id: sentMsg["id"], ok: true, value });
}

// ── Cleanup ────────────────────────────────────────────────────────────
afterEach(async () => {
  await _shutdownPool();
  mockWorkers.length = 0;
});

// ── Tests ──────────────────────────────────────────────────────────────
describe("pwhash-offload", () => {
  describe("hashPinOffload", () => {
    it("dispatches a hash request to a worker and resolves with the result", async () => {
      const promise = hashPinOffload("1234", "server");

      // Pool should have been created with 2 workers.
      expect(mockWorkers).toHaveLength(2);

      const { worker, sentMsg } = findDispatchedWorker();
      expect(sentMsg).toMatchObject({ op: "hash", pin: "1234", profile: "server" });
      expect(sentMsg).toHaveProperty("id");

      // Simulate worker responding.
      resolveDispatch(worker, sentMsg, "hashed-value");

      await expect(promise).resolves.toBe("hashed-value");
    });
  });

  describe("verifyPinOffload", () => {
    it("dispatches a verify request and resolves with a boolean", async () => {
      const promise = verifyPinOffload("stored-hash", "1234");

      const { worker, sentMsg } = findDispatchedWorker();
      expect(sentMsg).toMatchObject({ op: "verify", hash: "stored-hash", pin: "1234" });

      resolveDispatch(worker, sentMsg, true);

      await expect(promise).resolves.toBe(true);
    });
  });

  describe("round-robin dispatch", () => {
    it("alternates requests between workers in the pool", async () => {
      // Three consecutive dispatches should alternate between the two workers.
      const p1 = hashPinOffload("1111", "server");
      const p2 = hashPinOffload("2222", "server");
      const p3 = hashPinOffload("3333", "server");

      // Total calls across both workers should be 3, and both workers
      // should have received at least one call (round-robin guarantee).
      const totalCalls = mockWorkers.reduce((sum, w) => sum + w.postMessage.mock.calls.length, 0);
      expect(totalCalls).toBe(3);

      // One worker gets 2 calls, the other gets 1.
      const callCounts = mockWorkers.map((w) => w.postMessage.mock.calls.length).sort();
      expect(callCounts).toEqual([1, 2]);

      // Resolve all to avoid hanging promises.
      for (const worker of mockWorkers) {
        const handler = getHandler(worker, "message");
        for (const call of worker.postMessage.mock.calls) {
          const msg = call[0] as Record<string, unknown>;
          handler({ id: msg["id"], ok: true, value: "h" });
        }
      }

      await Promise.all([p1, p2, p3]);
    });
  });

  describe("worker error event", () => {
    it("rejects all pending requests when a worker emits an error", async () => {
      const p1 = hashPinOffload("1111", "server");
      const p2 = hashPinOffload("2222", "server");

      // Fire error on all workers to ensure both pending requests are rejected.
      const workerError = new Error("Worker crashed");
      for (const worker of mockWorkers) {
        const errorHandler = getHandler(worker, "error");
        errorHandler(workerError);
      }

      await expect(p1).rejects.toThrow("Worker crashed");
      await expect(p2).rejects.toThrow("Worker crashed");
    });
  });

  describe("worker message with ok=false", () => {
    it("rejects the individual request with the error message", async () => {
      const promise = hashPinOffload("bad-pin", "server");

      const { worker, sentMsg } = findDispatchedWorker();
      const messageHandler = getHandler(worker, "message");
      messageHandler({ id: sentMsg["id"], ok: false, error: "Hashing failed" });

      await expect(promise).rejects.toThrow("Hashing failed");
    });

    it("uses a default error message when none is provided", async () => {
      const promise = hashPinOffload("bad-pin", "server");

      const { worker, sentMsg } = findDispatchedWorker();
      const messageHandler = getHandler(worker, "message");
      messageHandler({ id: sentMsg["id"], ok: false });

      await expect(promise).rejects.toThrow("Worker error");
    });
  });

  describe("_shutdownPool", () => {
    it("terminates all workers and clears pending requests", async () => {
      // Create pool by dispatching a request (don't await -- it will never resolve).
      const promise = hashPinOffload("1234", "server");

      expect(mockWorkers).toHaveLength(2);

      await _shutdownPool();

      for (const worker of mockWorkers) {
        expect(worker.terminate).toHaveBeenCalledOnce();
      }

      // Verify the pool was nulled: the next call should create new workers.
      mockWorkers.length = 0;

      const p2 = hashPinOffload("5678", "server");
      expect(mockWorkers).toHaveLength(2); // Fresh pool created.

      // Clean up the new request.
      const { worker, sentMsg } = findDispatchedWorker();
      resolveDispatch(worker, sentMsg, "h");
      await p2;

      // Shutdown clears the pending map without rejecting — the promise
      // will never settle. Suppress the unhandled-rejection warning.
      void promise.catch(() => {
        /* intentionally orphaned by shutdown */
      });
    });
  });

  describe("re-initialization after shutdown", () => {
    it("creates a fresh pool when called after shutdown", async () => {
      // First call initialises pool.
      const p1 = hashPinOffload("1234", "server");
      const firstPoolWorkers = [...mockWorkers];
      expect(firstPoolWorkers).toHaveLength(2);

      // Resolve to clean up.
      const { worker: w1, sentMsg: msg1 } = findDispatchedWorker();
      resolveDispatch(w1, msg1, "h");
      await p1;

      // Shutdown then re-use.
      await _shutdownPool();
      mockWorkers.length = 0;

      const p2 = hashPinOffload("5678", "server");
      expect(mockWorkers).toHaveLength(2);

      // New workers are different instances.
      expect(mockWorkers[0]).not.toBe(firstPoolWorkers[0]);
      expect(mockWorkers[1]).not.toBe(firstPoolWorkers[1]);

      const { worker: w2, sentMsg: msg2 } = findDispatchedWorker();
      resolveDispatch(w2, msg2, "h2");
      await p2;
    });
  });

  describe("multiple concurrent requests", () => {
    it("assigns unique IDs and resolves each independently", async () => {
      const p1 = hashPinOffload("aaaa", "server");
      const p2 = verifyPinOffload("hash", "bbbb");
      const p3 = hashPinOffload("cccc", "server");

      // Collect all sent messages with their workers.
      const dispatches: { worker: MockWorker; msg: Record<string, unknown> }[] = [];
      for (const worker of mockWorkers) {
        for (const call of worker.postMessage.mock.calls) {
          dispatches.push({ worker, msg: call[0] as Record<string, unknown> });
        }
      }

      // Each request should have a unique ID.
      const allIds = new Set(dispatches.map((d) => d.msg["id"] as number));
      expect(allIds.size).toBe(3);

      // Find dispatches by op/pin to match them to their promises.
      const hashAaaa = dispatches.find((d) => d.msg["op"] === "hash" && d.msg["pin"] === "aaaa");
      const verifyBbbb = dispatches.find(
        (d) => d.msg["op"] === "verify" && d.msg["pin"] === "bbbb",
      );
      const hashCccc = dispatches.find((d) => d.msg["op"] === "hash" && d.msg["pin"] === "cccc");
      expect(hashAaaa).toBeDefined();
      expect(verifyBbbb).toBeDefined();
      expect(hashCccc).toBeDefined();

      // Resolve in reverse order to prove independence.
      if (!hashCccc || !verifyBbbb || !hashAaaa) {
        throw new Error("Expected all dispatches to be found");
      }

      const handler3 = getHandler(hashCccc.worker, "message");
      handler3({ id: hashCccc.msg["id"], ok: true, value: "hash-cccc" });
      await expect(p3).resolves.toBe("hash-cccc");

      const handler2 = getHandler(verifyBbbb.worker, "message");
      handler2({ id: verifyBbbb.msg["id"], ok: true, value: false });
      await expect(p2).resolves.toBe(false);

      const handler1 = getHandler(hashAaaa.worker, "message");
      handler1({ id: hashAaaa.msg["id"], ok: true, value: "hash-aaaa" });
      await expect(p1).resolves.toBe("hash-aaaa");
    });
  });
});
