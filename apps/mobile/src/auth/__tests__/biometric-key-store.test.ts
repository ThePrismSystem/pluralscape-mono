import { configureSodium, createWebKeyStorage, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it } from "vitest";

import { BiometricKeyStore } from "../biometric-key-store.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

describe("BiometricKeyStore", () => {
  it("returns null when no key is stored", async () => {
    const store = new BiometricKeyStore(createWebKeyStorage());
    const result = await store.retrieve();
    expect(result).toBeNull();
  });

  it("stores and retrieves the wrapped master key", async () => {
    const storage = createWebKeyStorage();
    const store = new BiometricKeyStore(storage);
    const key = new Uint8Array([1, 2, 3, 4, 5]);
    await store.enroll(key);
    const retrieved = await store.retrieve();
    expect(retrieved).toEqual(key);
  });

  it("clears the key on unenroll", async () => {
    const storage = createWebKeyStorage();
    const store = new BiometricKeyStore(storage);
    await store.enroll(new Uint8Array([10, 20, 30]));
    await store.unenroll();
    const result = await store.retrieve();
    expect(result).toBeNull();
  });
});
