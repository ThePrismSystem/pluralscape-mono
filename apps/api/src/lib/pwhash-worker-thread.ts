/**
 * Worker thread script for CPU-intensive PIN hashing via libsodium.
 *
 * Runs hashPin/verifyPin off the main event loop so that Argon2id
 * operations don't block request handling.
 */
import { parentPort } from "node:worker_threads";

import { initSodium } from "@pluralscape/crypto";

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

type WorkerRequest = HashRequest | VerifyRequest;

async function main(): Promise<void> {
  const port = parentPort;
  if (!port) throw new Error("pwhash-worker-thread must run as a Worker");

  // Eagerly initialise libsodium once when the worker starts.
  await initSodium();

  // Lazy import after sodium is ready.
  const { hashPin, verifyPin } = await import("@pluralscape/crypto");

  port.on("message", (msg: WorkerRequest) => {
    try {
      if (msg.op === "hash") {
        const result = hashPin(msg.pin, msg.profile);
        port.postMessage({ id: msg.id, ok: true, value: result });
      } else {
        const result = verifyPin(msg.hash, msg.pin);
        port.postMessage({ id: msg.id, ok: true, value: result });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      port.postMessage({ id: msg.id, ok: false, error: message });
    }
  });
}

void main();
