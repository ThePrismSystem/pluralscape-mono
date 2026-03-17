import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { InvalidInputError } from "../errors.js";
import { hashPin, verifyPin } from "../pin.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("hashPin", () => {
  it("returns an Argon2id encoded string", () => {
    const hash = hashPin("1234", "server");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("two calls with the same PIN produce different hashes (random salt)", () => {
    const h1 = hashPin("1234", "server");
    const h2 = hashPin("1234", "server");
    expect(h1).not.toBe(h2);
  });

  it("throws InvalidInputError for PIN shorter than 4 characters", () => {
    expect(() => hashPin("123", "server")).toThrow(InvalidInputError);
  });

  it("memzeros PIN bytes after hashing", () => {
    const spy = vi.spyOn(getSodium(), "memzero");
    hashPin("1234", "server");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("verifyPin", () => {
  it("returns true for matching PIN", () => {
    const hash = hashPin("5678", "server");
    expect(verifyPin(hash, "5678")).toBe(true);
  });

  it("returns false for wrong PIN", () => {
    const hash = hashPin("5678", "server");
    expect(verifyPin(hash, "9999")).toBe(false);
  });

  it("memzeros PIN bytes after verification", () => {
    const hash = hashPin("1234", "server");
    const spy = vi.spyOn(getSodium(), "memzero");
    verifyPin(hash, "1234");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
