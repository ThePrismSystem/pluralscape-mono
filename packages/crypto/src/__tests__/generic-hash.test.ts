import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GENERIC_HASH_BYTES_MAX, GENERIC_HASH_BYTES_MIN } from "../constants.js";
import { InvalidInputError } from "../errors.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("genericHash (BLAKE2b)", () => {
  it("produces output of the requested length", () => {
    const msg = new TextEncoder().encode("test");
    const hash = getSodium().genericHash(32, msg);
    expect(hash.length).toBe(32);
  });

  it("is deterministic — same inputs produce the same hash", () => {
    const msg = new TextEncoder().encode("deterministic");
    const h1 = getSodium().genericHash(32, msg);
    const h2 = getSodium().genericHash(32, msg);
    expect(h1).toEqual(h2);
  });

  it("different messages produce different hashes", () => {
    const h1 = getSodium().genericHash(32, new TextEncoder().encode("msg-a"));
    const h2 = getSodium().genericHash(32, new TextEncoder().encode("msg-b"));
    expect(h1).not.toEqual(h2);
  });

  it("keyed hash differs from unkeyed hash", () => {
    const msg = new TextEncoder().encode("keyed");
    const key = getSodium().randomBytes(32);
    const unkeyed = getSodium().genericHash(32, msg);
    const keyed = getSodium().genericHash(32, msg, key);
    expect(keyed).not.toEqual(unkeyed);
  });

  it("keyed hash is deterministic", () => {
    const msg = new TextEncoder().encode("keyed-det");
    const key = getSodium().randomBytes(32);
    const h1 = getSodium().genericHash(32, msg, key);
    const h2 = getSodium().genericHash(32, msg, key);
    expect(h1).toEqual(h2);
  });

  it("supports minimum hash length", () => {
    const hash = getSodium().genericHash(GENERIC_HASH_BYTES_MIN, new Uint8Array(1));
    expect(hash.length).toBe(GENERIC_HASH_BYTES_MIN);
  });

  it("supports maximum hash length", () => {
    const hash = getSodium().genericHash(GENERIC_HASH_BYTES_MAX, new Uint8Array(1));
    expect(hash.length).toBe(GENERIC_HASH_BYTES_MAX);
  });

  it("handles empty message", () => {
    const hash = getSodium().genericHash(32, new Uint8Array(0));
    expect(hash.length).toBe(32);
  });
});

describe("assertGenericHashLength validation", () => {
  it("below minimum throws InvalidInputError", () => {
    expect(() => getSodium().genericHash(GENERIC_HASH_BYTES_MIN - 1, new Uint8Array(1))).toThrow(
      InvalidInputError,
    );
  });

  it("above maximum throws InvalidInputError", () => {
    expect(() => getSodium().genericHash(GENERIC_HASH_BYTES_MAX + 1, new Uint8Array(1))).toThrow(
      InvalidInputError,
    );
  });
});
