/**
 * SodiumAdapter implementation using react-native-libsodium (JSI bindings).
 *
 * Known gaps (react-native-libsodium does not support):
 * - crypto_sign_seed_keypair — signSeedKeypair() throws UnsupportedOperationError
 * - memzero — polyfilled with Uint8Array.fill(0) unless NativeMemzero is provided
 *   via constructor for cryptographically secure zeroing (iOS memset_s, Android volatile loop)
 *
 * The missing ed25519-to-curve25519 conversion functions are not needed:
 * ADR 006 addendum specifies independent key derivation via KDF instead.
 *
 * @see https://github.com/nicolo-ribaudo/react-native-libsodium
 */
import { CryptoNotReadyError, UnsupportedOperationError } from "../errors.js";

import { BaseSodiumAdapter } from "./base-adapter.js";

import type { NativeMemzero } from "../lifecycle-types.js";
import type { SignKeypair } from "../types.js";
import type { SodiumLib } from "./base-adapter.js";

// react-native-libsodium is a peer dependency — only available in RN environments
type RNSodium = typeof import("react-native-libsodium");

export class ReactNativeSodiumAdapter extends BaseSodiumAdapter {
  private sodium: RNSodium | null = null;
  private readonly nativeMemzero: NativeMemzero | undefined;

  override get supportsSecureMemzero(): boolean {
    return this.nativeMemzero !== undefined;
  }

  constructor(nativeMemzero?: NativeMemzero) {
    super();
    this.nativeMemzero = nativeMemzero;
  }

  async init(): Promise<void> {
    if (this.sodium !== null) {
      return;
    }
    // Dynamic import — react-native-libsodium must be installed in the RN app
    const rnSodium: RNSodium = await import("react-native-libsodium");
    // Sumo version needed for crypto_pwhash
    await rnSodium.loadSumoVersion();
    await rnSodium.ready;
    this.sodium = rnSodium;
  }

  isReady(): boolean {
    return this.sodium !== null;
  }

  protected lib(): SodiumLib {
    if (this.sodium === null) {
      throw new CryptoNotReadyError("ReactNativeSodiumAdapter not initialized. Call init() first.");
    }
    return this.sodium;
  }

  // ── RN-specific overrides ─────────────────────────────────────────

  /**
   * Not supported on React Native — react-native-libsodium does not expose
   * crypto_sign_seed_keypair. Use KDF to derive seed material and store the
   * full keypair instead.
   */
  signSeedKeypair(): SignKeypair {
    throw new UnsupportedOperationError("signSeedKeypair", "react-native");
  }

  /**
   * Not supported on React Native — password hashing is always server-side.
   */
  pwhashStr(): string {
    throw new UnsupportedOperationError("pwhashStr", "react-native");
  }

  /**
   * Not supported on React Native — password verification is always server-side.
   */
  pwhashStrVerify(): boolean {
    throw new UnsupportedOperationError("pwhashStrVerify", "react-native");
  }

  // ── Memory ────────────────────────────────────────────────────────

  /**
   * Secure memzero when NativeMemzero is provided; best-effort polyfill otherwise.
   *
   * Without NativeMemzero, uses Uint8Array.fill(0) which may be optimized away
   * by Hermes. Provide a NativeMemzero via the constructor for cryptographically
   * secure zeroing backed by platform-native APIs.
   */
  memzero(buffer: Uint8Array): void {
    if (this.nativeMemzero !== undefined) {
      this.nativeMemzero.memzero(buffer);
    } else {
      buffer.fill(0);
    }
  }
}
