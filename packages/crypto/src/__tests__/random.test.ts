import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";

import type { SodiumAdapter } from "../adapter/interface.js";

let adapter: SodiumAdapter;

beforeAll(async () => {
  adapter = new WasmSodiumAdapter();
  await adapter.init();
});

afterAll(() => {
  // No cleanup needed — WASM adapter has no teardown
});

describe("randomBytes", () => {
  it("returns bytes of the requested length", () => {
    const bytes = adapter.randomBytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it("returns different values on successive calls", () => {
    const a = adapter.randomBytes(32);
    const b = adapter.randomBytes(32);
    expect(a).not.toEqual(b);
  });

  it("handles zero length", () => {
    const bytes = adapter.randomBytes(0);
    expect(bytes.length).toBe(0);
  });

  it("handles large lengths", () => {
    const bytes = adapter.randomBytes(1024);
    expect(bytes.length).toBe(1024);
  });
});
