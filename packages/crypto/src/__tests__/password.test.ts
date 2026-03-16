import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { InvalidInputError } from "../errors.js";
import { hashPassword, verifyPassword } from "../password.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

describe("hashPassword", () => {
  it("returns an Argon2id encoded string", () => {
    const hash = hashPassword("testpassword123", "server");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("two calls with the same password produce different hashes (random salt)", () => {
    const h1 = hashPassword("testpassword123", "server");
    const h2 = hashPassword("testpassword123", "server");
    expect(h1).not.toBe(h2);
  });

  it("throws InvalidInputError for password shorter than 8 characters", () => {
    expect(() => hashPassword("short", "server")).toThrow(InvalidInputError);
  });

  it("memzeros password bytes after hashing", () => {
    const spy = vi.spyOn(getSodium(), "memzero");
    hashPassword("testpassword123", "server");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("verifyPassword", () => {
  it("returns true for matching password", () => {
    const hash = hashPassword("correcthorse", "server");
    expect(verifyPassword(hash, "correcthorse")).toBe(true);
  });

  it("returns false for wrong password", () => {
    const hash = hashPassword("correcthorse", "server");
    expect(verifyPassword(hash, "wrongpassword")).toBe(false);
  });

  it("memzeros password bytes after verification", () => {
    const hash = hashPassword("testpassword123", "server");
    const spy = vi.spyOn(getSodium(), "memzero");
    verifyPassword(hash, "testpassword123");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
