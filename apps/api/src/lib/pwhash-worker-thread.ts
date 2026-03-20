/**
 * Worker thread script for CPU-intensive PIN hashing via libsodium.
 *
 * Runs hashPin/verifyPin/deriveTransferKey off the main event loop so that
 * Argon2id operations don't block request handling.
 */
import { parentPort } from "node:worker_threads";

import { initSodium } from "@pluralscape/crypto";

import type { PwhashSalt } from "@pluralscape/crypto";

interface HashRequest {
  readonly id: number;
  readonly op: "hash";
  readonly pin: string;
  readonly profile: "server";
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

async function main(): Promise<void> {
  const port = parentPort;
  if (!port) throw new Error("pwhash-worker-thread must run as a Worker");

  // Eagerly initialise libsodium once when the worker starts.
  await initSodium();

  // Lazy import after sodium is ready.
  const { hashPin, verifyPin, deriveTransferKey, assertPwhashSalt } =
    await import("@pluralscape/crypto");

  // Re-bind with explicit type so TS accepts it as an assertion function.
  const validateSalt: (salt: Uint8Array) => asserts salt is PwhashSalt = assertPwhashSalt;

  port.on("message", (msg: WorkerRequest) => {
    try {
      if (msg.op === "hash") {
        const result = hashPin(msg.pin, msg.profile);
        port.postMessage({ id: msg.id, ok: true, value: result });
      } else if (msg.op === "verify") {
        const result = verifyPin(msg.hash, msg.pin);
        port.postMessage({ id: msg.id, ok: true, value: result });
      } else {
        const salt = msg.salt;
        validateSalt(salt);
        const result = deriveTransferKey(msg.code, salt);
        port.postMessage({ id: msg.id, ok: true, value: result });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      port.postMessage({ id: msg.id, ok: false, error: message });
    }
  });
}

void main();
