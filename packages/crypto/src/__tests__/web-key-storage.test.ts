import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidInputError } from "../errors.js";
import { getSodium } from "../sodium.js";
import { createWebKeyStorage } from "../web-key-storage.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { SecureKeyStorage } from "../key-storage.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

let storage: SecureKeyStorage;

beforeEach(() => {
  storage = createWebKeyStorage();
});

describe("store / retrieve", () => {
  it("roundtrip: store then retrieve returns the same bytes", async () => {
    const key = getSodium().randomBytes(32);
    await storage.store("key-1", key);
    const retrieved = await storage.retrieve("key-1");
    expect(retrieved).toEqual(key);
  });

  it("retrieve returns null for unknown keyId", async () => {
    expect(await storage.retrieve("unknown")).toBeNull();
  });

  it("overwrite: storing again replaces the key", async () => {
    const key1 = getSodium().randomBytes(32);
    const key2 = getSodium().randomBytes(32);
    await storage.store("key-1", key1);
    await storage.store("key-1", key2);
    const retrieved = await storage.retrieve("key-1");
    expect(retrieved).toEqual(key2);
  });

  it("stores an independent copy — mutating the original does not affect stored value", async () => {
    const key = new Uint8Array([1, 2, 3, 4]);
    await storage.store("key-1", key);
    key[0] = 0xff; // mutate original
    const retrieved = await storage.retrieve("key-1");
    expect(retrieved?.[0]).toBe(1);
  });

  it("retrieve returns an independent copy — mutating the result does not affect stored value", async () => {
    const key = new Uint8Array([10, 20, 30]);
    await storage.store("key-1", key);
    const retrieved = await storage.retrieve("key-1");
    if (retrieved) retrieved[0] = 0xff; // mutate returned copy
    const second = await storage.retrieve("key-1");
    expect(second?.[0]).toBe(10);
  });

  it("accepts optional opts without error (opts ignored on web)", async () => {
    const key = getSodium().randomBytes(32);
    await expect(
      storage.store("key-1", key, { requireBiometric: true, accessibility: "whenUnlocked" }),
    ).resolves.toBeUndefined();
    await expect(
      storage.store("key-2", key, {
        requireBiometric: false,
        accessibility: "afterFirstUnlock",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("overwrite memzeros old value", () => {
  it("memzeros the old bytes when overwriting an existing key", async () => {
    const key1 = getSodium().randomBytes(32);
    const key1Copy = new Uint8Array(key1); // copy before storage takes it
    await storage.store("key-1", key1);

    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    await storage.store("key-1", getSodium().randomBytes(32));
    // The stored copy should have been zeroed — check that memzero was called
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
    void key1Copy; // suppress unused warning
  });
});

describe("delete", () => {
  it("removes the key — retrieve returns null after delete", async () => {
    const key = getSodium().randomBytes(32);
    await storage.store("key-1", key);
    await storage.delete("key-1");
    expect(await storage.retrieve("key-1")).toBeNull();
  });

  it("memzeros the stored bytes on delete", async () => {
    await storage.store("key-1", getSodium().randomBytes(32));
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    await storage.delete("key-1");
    expect(memzeroSpy).toHaveBeenCalledTimes(1);
    memzeroSpy.mockRestore();
  });

  it("is a no-op for an unknown keyId", async () => {
    await expect(storage.delete("nonexistent")).resolves.toBeUndefined();
  });

  it("does not call memzero for an unknown keyId", async () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    await storage.delete("nonexistent");
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});

describe("clearAll", () => {
  it("removes all stored keys", async () => {
    await storage.store("a", getSodium().randomBytes(32));
    await storage.store("b", getSodium().randomBytes(32));
    await storage.clearAll();
    expect(await storage.retrieve("a")).toBeNull();
    expect(await storage.retrieve("b")).toBeNull();
  });

  it("memzeros all stored bytes", async () => {
    await storage.store("a", getSodium().randomBytes(32));
    await storage.store("b", getSodium().randomBytes(32));
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    await storage.clearAll();
    expect(memzeroSpy).toHaveBeenCalledTimes(2);
    memzeroSpy.mockRestore();
  });

  it("is safe on an empty storage", async () => {
    await expect(storage.clearAll()).resolves.toBeUndefined();
  });

  it("does not call memzero on empty storage", async () => {
    const sodium = getSodium();
    const memzeroSpy = vi.spyOn(sodium, "memzero");
    await storage.clearAll();
    expect(memzeroSpy).not.toHaveBeenCalled();
    memzeroSpy.mockRestore();
  });
});

describe("requiresBiometric", () => {
  it("returns false on web", () => {
    expect(storage.requiresBiometric()).toBe(false);
  });
});

describe("validation", () => {
  it("throws InvalidInputError for empty keyId on store", async () => {
    await expect(storage.store("", getSodium().randomBytes(32))).rejects.toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for empty keyId on retrieve", async () => {
    await expect(storage.retrieve("")).rejects.toThrow(InvalidInputError);
  });

  it("throws InvalidInputError for empty keyId on delete", async () => {
    await expect(storage.delete("")).rejects.toThrow(InvalidInputError);
  });
});
