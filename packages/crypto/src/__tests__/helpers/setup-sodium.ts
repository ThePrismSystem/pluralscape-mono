import { WasmSodiumAdapter } from "../../adapter/wasm-adapter.js";
import { _resetForTesting, configureSodium, initSodium } from "../../sodium.js";

export async function setupSodium(): Promise<void> {
  _resetForTesting();
  const adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
}

export function teardownSodium(): void {
  _resetForTesting();
}
