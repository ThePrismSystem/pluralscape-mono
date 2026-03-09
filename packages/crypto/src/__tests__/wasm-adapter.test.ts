import { beforeEach, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { CryptoNotReadyError } from "../errors.js";

describe("WasmSodiumAdapter", () => {
  let adapter: WasmSodiumAdapter;

  beforeEach(() => {
    adapter = new WasmSodiumAdapter();
  });

  it("init() is idempotent — second call returns immediately", async () => {
    await adapter.init();
    expect(adapter.isReady()).toBe(true);
    await adapter.init();
    expect(adapter.isReady()).toBe(true);
  });

  it("throws CryptoNotReadyError before init", () => {
    expect(adapter.isReady()).toBe(false);
    expect(() => adapter.aeadKeygen()).toThrow(CryptoNotReadyError);
  });
});
