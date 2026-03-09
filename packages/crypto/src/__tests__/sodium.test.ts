import { afterEach, describe, expect, it } from "vitest";

import { SODIUM_CONSTANTS } from "../constants.js";
import { AlreadyInitializedError, CryptoNotReadyError } from "../errors.js";
import { _resetForTesting, configureSodium, getSodium, initSodium, isReady } from "../sodium.js";

import type { SodiumAdapter } from "../adapter/interface.js";

function stubAdapter(overrides: Partial<SodiumAdapter> = {}): SodiumAdapter {
  const noop = (): never => {
    throw new Error("not implemented in stub");
  };
  return {
    init: () => Promise.resolve(),
    isReady: () => true,
    constants: SODIUM_CONSTANTS,
    supportsSecureMemzero: true,
    aeadEncrypt: noop,
    aeadDecrypt: noop,
    aeadKeygen: noop,
    boxKeypair: noop,
    boxSeedKeypair: noop,
    boxEasy: noop,
    boxOpenEasy: noop,
    signKeypair: noop,
    signSeedKeypair: noop,
    signDetached: noop,
    signVerifyDetached: noop,
    pwhash: noop,
    kdfDeriveFromKey: noop,
    kdfKeygen: noop,
    randomBytes: noop,
    memzero: noop,
    ...overrides,
  };
}

afterEach(() => {
  _resetForTesting();
});

describe("getSodium", () => {
  it("throws CryptoNotReadyError before initialization", () => {
    expect(() => getSodium()).toThrow(CryptoNotReadyError);
  });

  it("returns the adapter after initialization", async () => {
    await initSodium();
    const sodium = getSodium();
    expect(sodium).toBeDefined();
    expect(sodium.isReady()).toBe(true);
  });
});

describe("isReady", () => {
  it("returns false before initialization", () => {
    expect(isReady()).toBe(false);
  });

  it("returns true after initialization", async () => {
    await initSodium();
    expect(isReady()).toBe(true);
  });
});

describe("initSodium", () => {
  it("is idempotent — multiple calls do not throw", async () => {
    await initSodium();
    await initSodium();
    expect(isReady()).toBe(true);
  });

  it("defaults to WasmSodiumAdapter when no adapter configured", async () => {
    await initSodium();
    const sodium = getSodium();
    expect(sodium.constants.AEAD_KEY_BYTES).toBe(32);
  });

  it("concurrent initSodium() calls resolve safely", async () => {
    const results = await Promise.all([initSodium(), initSodium(), initSodium()]);
    expect(results).toHaveLength(3);
    expect(isReady()).toBe(true);
  });

  it("adapter.init() called only once with concurrent calls", async () => {
    let initCount = 0;
    const mock = stubAdapter({
      init: async () => {
        initCount++;
        // Simulate async work — yield microtask
        await Promise.resolve();
      },
    });
    configureSodium(mock);

    await Promise.all([initSodium(), initSodium(), initSodium()]);
    expect(initCount).toBe(1);
  });

  it("throws CryptoNotReadyError with cause when adapter.init() fails", async () => {
    _resetForTesting();
    const error = new Error("init failed");
    configureSodium({ ...stubAdapter(), init: () => Promise.reject(error) });
    await expect(initSodium()).rejects.toThrow(CryptoNotReadyError);
  });
});

describe("configureSodium", () => {
  it("throws AlreadyInitializedError if called after init", async () => {
    await initSodium();
    expect(() => {
      configureSodium(stubAdapter());
    }).toThrow(AlreadyInitializedError);
  });

  it("accepts a custom adapter before init", async () => {
    let initCalled = false;
    const mock = stubAdapter({
      init: () => {
        initCalled = true;
        return Promise.resolve();
      },
      isReady: () => initCalled,
    });

    configureSodium(mock);
    expect(initCalled).toBe(false);
    await initSodium();
    expect(initCalled).toBe(true);
    expect(getSodium()).toBe(mock);
  });
});
