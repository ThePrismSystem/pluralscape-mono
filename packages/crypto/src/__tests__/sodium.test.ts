import { afterEach, describe, expect, it } from "vitest";

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
    constants: {
      AEAD_KEY_BYTES: 0,
      AEAD_NONCE_BYTES: 0,
      AEAD_TAG_BYTES: 0,
      BOX_PUBLIC_KEY_BYTES: 0,
      BOX_SECRET_KEY_BYTES: 0,
      BOX_NONCE_BYTES: 0,
      BOX_MAC_BYTES: 0,
      BOX_SEED_BYTES: 0,
      SIGN_PUBLIC_KEY_BYTES: 0,
      SIGN_SECRET_KEY_BYTES: 0,
      SIGN_BYTES: 0,
      SIGN_SEED_BYTES: 0,
      PWHASH_SALT_BYTES: 0,
      PWHASH_OPSLIMIT_INTERACTIVE: 0,
      PWHASH_MEMLIMIT_INTERACTIVE: 0,
      PWHASH_OPSLIMIT_MODERATE: 0,
      PWHASH_MEMLIMIT_MODERATE: 0,
      KDF_KEY_BYTES: 0,
      KDF_CONTEXT_BYTES: 0,
      KDF_BYTES_MIN: 0,
      KDF_BYTES_MAX: 0,
    },
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
