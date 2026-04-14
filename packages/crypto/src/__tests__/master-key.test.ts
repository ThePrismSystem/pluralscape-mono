import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { PWHASH_SALT_BYTES } from "../crypto.constants.js";
import { generateSalt } from "../master-key.js";
import { _resetForTesting, configureSodium, initSodium } from "../sodium.js";

beforeAll(async () => {
  _resetForTesting();
  const adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
});

afterAll(() => {
  _resetForTesting();
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
