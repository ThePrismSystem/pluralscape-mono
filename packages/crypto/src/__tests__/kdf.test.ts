import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { KDF_KEY_BYTES } from "../constants.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("KDF sub-key derivation", () => {
  it("derives a sub-key of the requested length", () => {
    const masterKey = adapter.kdfKeygen();
    const subkey = adapter.kdfDeriveFromKey(32, 1, "testctx!", masterKey);

    expect(subkey.length).toBe(32);
  });

  it("is deterministic — same inputs produce the same sub-key", () => {
    const masterKey = adapter.kdfKeygen();

    const sub1 = adapter.kdfDeriveFromKey(32, 1, "testctx!", masterKey);
    const sub2 = adapter.kdfDeriveFromKey(32, 1, "testctx!", masterKey);

    expect(sub1).toEqual(sub2);
  });

  it("different subkey IDs produce different sub-keys", () => {
    const masterKey = adapter.kdfKeygen();

    const sub1 = adapter.kdfDeriveFromKey(32, 1, "testctx!", masterKey);
    const sub2 = adapter.kdfDeriveFromKey(32, 2, "testctx!", masterKey);

    expect(sub1).not.toEqual(sub2);
  });

  it("different contexts produce different sub-keys", () => {
    const masterKey = adapter.kdfKeygen();

    const sub1 = adapter.kdfDeriveFromKey(32, 1, "context1", masterKey);
    const sub2 = adapter.kdfDeriveFromKey(32, 1, "context2", masterKey);

    expect(sub1).not.toEqual(sub2);
  });

  it("different master keys produce different sub-keys", () => {
    const mk1 = adapter.kdfKeygen();
    const mk2 = adapter.kdfKeygen();

    const sub1 = adapter.kdfDeriveFromKey(32, 1, "testctx!", mk1);
    const sub2 = adapter.kdfDeriveFromKey(32, 1, "testctx!", mk2);

    expect(sub1).not.toEqual(sub2);
  });

  it("supports variable sub-key lengths", () => {
    const masterKey = adapter.kdfKeygen();

    const short = adapter.kdfDeriveFromKey(16, 1, "testctx!", masterKey);
    const long = adapter.kdfDeriveFromKey(64, 1, "testctx!", masterKey);

    expect(short.length).toBe(16);
    expect(long.length).toBe(64);
  });
});

describe("kdfKeygen", () => {
  it("generates a key of the correct size", () => {
    const key = adapter.kdfKeygen();
    expect(key.length).toBe(KDF_KEY_BYTES);
  });

  it("generates unique keys", () => {
    const a = adapter.kdfKeygen();
    const b = adapter.kdfKeygen();
    expect(a).not.toEqual(b);
  });
});
