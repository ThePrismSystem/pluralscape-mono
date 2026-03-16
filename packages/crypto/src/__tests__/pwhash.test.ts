import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { PWHASH_OPSLIMIT_INTERACTIVE, PWHASH_MEMLIMIT_INTERACTIVE } from "../crypto.constants.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

function toBytes(s: string): Uint8Array {
  return Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)));
}

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("Argon2id password hashing", () => {
  it("derives a key of the requested length", () => {
    const password = toBytes("test-password");
    const salt = adapter.randomBytes(16);

    const derived = adapter.pwhash(
      32,
      password,
      salt,
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );

    expect(derived.length).toBe(32);
  });

  it("is deterministic — same inputs produce the same key", () => {
    const password = toBytes("deterministic");
    const salt = adapter.randomBytes(16);

    const key1 = adapter.pwhash(
      32,
      password,
      salt,
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );
    const key2 = adapter.pwhash(
      32,
      password,
      salt,
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );

    expect(key1).toEqual(key2);
  });

  it("produces different keys for different passwords", () => {
    const salt = adapter.randomBytes(16);

    const key1 = adapter.pwhash(
      32,
      toBytes("password-a"),
      salt,
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );
    const key2 = adapter.pwhash(
      32,
      toBytes("password-b"),
      salt,
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );

    expect(key1).not.toEqual(key2);
  });

  it("produces different keys for different salts", () => {
    const password = toBytes("same-password");

    const key1 = adapter.pwhash(
      32,
      password,
      adapter.randomBytes(16),
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );
    const key2 = adapter.pwhash(
      32,
      password,
      adapter.randomBytes(16),
      PWHASH_OPSLIMIT_INTERACTIVE,
      PWHASH_MEMLIMIT_INTERACTIVE,
    );

    expect(key1).not.toEqual(key2);
  });
});
