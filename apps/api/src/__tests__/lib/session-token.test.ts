import { initSodium } from "@pluralscape/crypto";
import { beforeAll, describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "../../lib/session-token.js";

beforeAll(async () => {
  await initSodium();
});

describe("generateSessionToken", () => {
  it("returns a 64-character lowercase hex string", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different values on successive calls", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
  });
});

describe("hashSessionToken", () => {
  it("returns a 128-character lowercase hex string", () => {
    const hash = hashSessionToken("a0".repeat(32));
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("is deterministic for the same input", () => {
    const input = "deadbeef".repeat(8);
    const a = hashSessionToken(input);
    const b = hashSessionToken(input);
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = hashSessionToken("a0".repeat(32));
    const b = hashSessionToken("b0".repeat(32));
    expect(a).not.toBe(b);
  });
});
