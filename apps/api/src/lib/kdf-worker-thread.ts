/**
 * Worker thread script for CPU-intensive PIN hashing and transfer key derivation via libsodium.
 *
 * Runs hashPin/verifyPin/deriveTransferKey off the main event loop so that
 * Argon2id operations don't block request handling.
 *
 * The message listener is registered synchronously before any async work
 * so that messages sent by the main thread during sodium initialization
 * are queued and drained once ready, preventing a race condition.
 */
import { parentPort } from "node:worker_threads";

import { initSodium } from "@pluralscape/crypto";

import type { PwhashSalt } from "@pluralscape/crypto";

interface HashRequest {
  readonly id: number;
  readonly op: "hash";
  readonly pin: string;
}

interface VerifyRequest {
  readonly id: number;
  readonly op: "verify";
  readonly hash: string;
  readonly pin: string;
}

interface DeriveTransferKeyRequest {
  readonly id: number;
  readonly op: "deriveTransferKey";
  readonly code: string;
  readonly salt: Uint8Array;
}

type WorkerRequest = HashRequest | VerifyRequest | DeriveTransferKeyRequest;

function main(): void {
  if (!parentPort) throw new Error("pwhash-worker-thread must run as a Worker");
  const port = parentPort;

  // Queue messages received before initialization completes.
  const pendingMessages: WorkerRequest[] = [];
  let handleMessage: ((msg: WorkerRequest) => void) | null = null;

  // Register the listener synchronously so no messages are lost during init.
  port.on("message", (msg: WorkerRequest) => {
    if (handleMessage) {
      handleMessage(msg);
    } else {
      pendingMessages.push(msg);
    }
  });

  async function init(): Promise<void> {
    await initSodium();

    const { hashPin, verifyPin, deriveTransferKey, assertPwhashSalt } =
      await import("@pluralscape/crypto");

    const validateSalt: (salt: Uint8Array) => asserts salt is PwhashSalt = assertPwhashSalt;

    handleMessage = (msg: WorkerRequest): void => {
      try {
        switch (msg.op) {
          case "hash": {
            const result = hashPin(msg.pin);
            port.postMessage({ id: msg.id, ok: true, value: result });
            break;
          }
          case "verify": {
            const result = verifyPin(msg.hash, msg.pin);
            port.postMessage({ id: msg.id, ok: true, value: result });
            break;
          }
          case "deriveTransferKey": {
            const salt = msg.salt;
            validateSalt(salt);
            const result = deriveTransferKey(msg.code, salt);
            port.postMessage({ id: msg.id, ok: true, value: result });
            break;
          }
          default: {
            const _exhaustive: never = msg;
            throw new Error(`Unknown operation: ${(_exhaustive as WorkerRequest).op}`);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        port.postMessage({ id: msg.id, ok: false, error: message });
      }
    };

    // Drain any messages that arrived during initialization.
    for (const queued of pendingMessages) {
      handleMessage(queued);
    }
    pendingMessages.length = 0;
  }

  void init();
}

main();
