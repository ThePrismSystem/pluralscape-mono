import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { KDF_KEY_BYTES, PWHASH_SALT_BYTES } from "../crypto.constants.js";
import { InvalidInputError } from "../errors.js";
import { deriveMasterKey, generateSalt } from "../master-key.js";
import { _resetForTesting, configureSodium, initSodium } from "../sodium.js";

import type { PwhashSalt } from "../types.js";

let salt: PwhashSalt;

beforeAll(async () => {
  _resetForTesting();
  const adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
  salt = generateSalt();
});

afterAll(() => {
  _resetForTesting();
});

describe("deriveMasterKey", () => {
  it("derives a 32-byte key", async () => {
    const key = await deriveMasterKey("test-password", salt, "server");
    expect(key.length).toBe(KDF_KEY_BYTES);
  });

  it("is deterministic — same password + salt + profile = same key", async () => {
    const key1 = await deriveMasterKey("deterministic", salt, "server");
    const key2 = await deriveMasterKey("deterministic", salt, "server");
    expect(key1).toEqual(key2);
  });

  it("produces different keys for different passwords", async () => {
    const key1 = await deriveMasterKey("password-a", salt, "server");
    const key2 = await deriveMasterKey("password-b", salt, "server");
    expect(key1).not.toEqual(key2);
  });

  it("produces different keys for different salts", async () => {
    const salt2 = generateSalt();
    const key1 = await deriveMasterKey("same-password", salt, "server");
    const key2 = await deriveMasterKey("same-password", salt2, "server");
    expect(key1).not.toEqual(key2);
  });

  it("produces different keys for different profiles", async () => {
    const key1 = await deriveMasterKey("same-password", salt, "server");
    const key2 = await deriveMasterKey("same-password", salt, "mobile");
    expect(key1).not.toEqual(key2);
  });

  it("logs derivation time for benchmarking", async () => {
    const start = Date.now();
    await deriveMasterKey("benchmark", salt, "mobile");
    const elapsed = Date.now() - start;
    // Derivation should take measurable time due to Argon2id
    expect(elapsed).toBeGreaterThan(0);
  });

  it("rejects empty password with InvalidInputError", () => {
    expect(() => deriveMasterKey("", salt, "server")).toThrow(/at least 8 characters/);
  });

  it("rejects short password with InvalidInputError", () => {
    expect(() => deriveMasterKey("short", salt, "server")).toThrow(InvalidInputError);
    expect(() => deriveMasterKey("1234567", salt, "server")).toThrow(/at least 8 characters/);
  });
});

describe("generateSalt", () => {
  it("returns 16 bytes", () => {
    const s = generateSalt();
    expect(s.length).toBe(PWHASH_SALT_BYTES);
  });

  it("returns unique values", () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toEqual(b);
  });
});
