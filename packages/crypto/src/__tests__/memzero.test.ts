import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed
});

describe("memzero", () => {
  it("zeros all bytes in a buffer", () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5]);
    adapter.memzero(buffer);
    expect(buffer.every((b) => b === 0)).toBe(true);
  });

  it("modifies the original buffer reference", () => {
    const buffer = new Uint8Array([0xff, 0xfe, 0xfd]);
    const ref = buffer;
    adapter.memzero(buffer);
    expect(ref[0]).toBe(0);
    expect(ref[1]).toBe(0);
    expect(ref[2]).toBe(0);
  });

  it("handles empty buffer", () => {
    const buffer = new Uint8Array(0);
    expect(() => {
      adapter.memzero(buffer);
    }).not.toThrow();
  });
});

describe("supportsSecureMemzero", () => {
  it("is true on WASM adapter", () => {
    expect(adapter.supportsSecureMemzero).toBe(true);
  });
});
