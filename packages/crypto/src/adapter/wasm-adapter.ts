import { CryptoNotReadyError } from "../errors.js";
import { assertSignSeed } from "../validation.js";

import { BaseSodiumAdapter } from "./base-adapter.js";

import type { SignKeypair, SignPublicKey, SignSecretKey } from "../types.js";
import type libsodiumSumo from "libsodium-wrappers-sumo";

/**
 * SodiumAdapter implementation using libsodium-wrappers-sumo (WASM).
 * Works in Bun, Node.js, and web browsers.
 */
export class WasmSodiumAdapter extends BaseSodiumAdapter {
  private sodium: typeof libsodiumSumo | null = null;

  override readonly supportsSecureMemzero = true;

  async init(): Promise<void> {
    if (this.sodium !== null) {
      return;
    }
    const sodiumModule = await import("libsodium-wrappers-sumo");
    const sodium = sodiumModule.default;
    await sodium.ready;
    this.sodium = sodium;
  }

  isReady(): boolean {
    return this.sodium !== null;
  }

  protected override lib(): typeof libsodiumSumo {
    if (this.sodium === null) {
      throw new CryptoNotReadyError("WasmSodiumAdapter not initialized. Call init() first.");
    }
    return this.sodium;
  }

  // ── WASM-specific overrides ───────────────────────────────────────

  signSeedKeypair(seed: Uint8Array): SignKeypair {
    assertSignSeed(seed);
    const sodium = this.lib();
    const kp = sodium.crypto_sign_seed_keypair(seed);
    return { publicKey: kp.publicKey as SignPublicKey, secretKey: kp.privateKey as SignSecretKey };
  }

  pwhashStr(password: Uint8Array, opsLimit: number, memLimit: number): string {
    const sodium = this.lib();
    // Type defs report Uint8Array but runtime returns a null-terminated ASCII string.
    // Handle both cases: decode Uint8Array or strip null terminator from string.
    const result: Uint8Array | string = sodium.crypto_pwhash_str(password, opsLimit, memLimit) as
      | Uint8Array
      | string;
    if (typeof result === "string") {
      return result.replace(/\0+$/, "");
    }
    return new TextDecoder().decode(result).replace(/\0+$/, "");
  }

  pwhashStrVerify(hash: string, password: Uint8Array): boolean {
    const sodium = this.lib();
    return sodium.crypto_pwhash_str_verify(hash, password);
  }

  // ── Memory ────────────────────────────────────────────────────────

  memzero(buffer: Uint8Array): void {
    const sodium = this.lib();
    sodium.memzero(buffer);
  }
}
